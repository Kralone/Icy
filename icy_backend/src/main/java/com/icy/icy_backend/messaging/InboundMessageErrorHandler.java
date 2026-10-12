package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.MessagePropertiesBuilder;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.MessageConversionException;
import org.springframework.amqp.rabbit.listener.api.RabbitListenerErrorHandler;
import org.springframework.amqp.listener.ListenerExecutionFailedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sort réservé à un message venu du bot Discord que son écouteur n'a pas pu traiter.
 * Sans cette règle, le conteneur le remettait en file aussitôt, indéfiniment.
 *
 * <ul>
 *   <li>Message invalide (contenu inexploitable) : rangé tout de suite dans la file morte, jamais réessayé.</li>
 *   <li>Erreur temporaire (base indisponible, verrou) : réessayé après un délai, un nombre borné de fois, puis rangé dans la file morte.</li>
 * </ul>
 * Un message obsolète (événement supprimé entre-temps) est acquitté par l'écouteur lui-même, avec un journal.
 * Aucun message exploitable n'est perdu en silence : chaque rangement est journalisé avec sa raison.
 */
@Slf4j
@Component("inboundMessageErrorHandler")
public class InboundMessageErrorHandler implements RabbitListenerErrorHandler {
    static final String RETRY_COUNT_HEADER = "x-iceforge-retry-count";
    static final String FAILURE_REASON_HEADER = "x-iceforge-failure-reason";

    private final RabbitTemplate rabbitTemplate;
    private final int retryLimit;

    public InboundMessageErrorHandler(RabbitTemplate rabbitTemplate, @Value("${iceforge.rabbit.inbound-retry-limit:3}") int retryLimit) {
        this.rabbitTemplate = rabbitTemplate;
        this.retryLimit = Math.max(0, Math.min(10, retryLimit));
    }

    @Override
    public Object handleError(Message amqpMessage, Channel channel, org.springframework.messaging.Message<?> message, ListenerExecutionFailedException exception) {
        Throwable cause = exception.getCause() == null ? exception : exception.getCause();
        String routingKey = amqpMessage.getMessageProperties().getReceivedRoutingKey();
        String failure = describe(cause);

        if (isPermanent(cause)) {
            park(amqpMessage, routingKey, "invalid_message", null);
            log.error("Message RabbitMQ invalide rangé en file morte, sans nouvel essai : clé={} cause={}", routingKey, failure);
            return null;
        }

        int attempts = retryCount(amqpMessage);
        if (attempts < retryLimit) {
            republish(RabbitConfig.BACKEND_RETRY_EXCHANGE, amqpMessage, routingKey, attempts + 1, null);
            log.warn("Traitement RabbitMQ en échec, nouvel essai {}/{} dans {} ms : clé={} cause={}",
                    attempts + 1, retryLimit, RabbitConfig.BACKEND_RETRY_DELAY_MS, routingKey, failure);
            return null;
        }

        park(amqpMessage, routingKey, "retries_exhausted", attempts);
        log.error("Traitement RabbitMQ abandonné après {} essai(s), message rangé en file morte : clé={} cause={}", attempts, routingKey, failure);
        return null;
    }

    /** Cause d'origine en une ligne, pour le journal : la classe et le message de l'exception la plus profonde. */
    private static String describe(Throwable cause) {
        Throwable root = cause;
        for (int depth = 0; root.getCause() != null && root.getCause() != root && depth < 10; depth++) root = root.getCause();
        String message = root.getMessage() == null ? "" : root.getMessage().replaceAll("\s+", " ").trim();
        if (message.length() > 200) message = message.substring(0, 200) + "…";
        return message.isEmpty() ? root.getClass().getSimpleName() : root.getClass().getSimpleName() + " : " + message;
    }

    /** Une charge refusée pour son contenu ou son format le sera à chaque essai : la réessayer ne sert à rien. */
    private static boolean isPermanent(Throwable cause) {
        for (Throwable current = cause; current != null; current = current.getCause()) {
            if (current instanceof IllegalArgumentException || current instanceof AmqpRejectAndDontRequeueException || current instanceof ClassCastException
                    || current instanceof NullPointerException || current instanceof MessageConversionException) return true;
            if (current.getCause() == current) break;
        }
        return false;
    }

    private static int retryCount(Message message) {
        Object value = message.getMessageProperties().getHeaders().get(RETRY_COUNT_HEADER);
        try {
            return value == null ? 0 : Math.max(0, Integer.parseInt(String.valueOf(value)));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void park(Message message, String routingKey, String reason, Integer attempts) {
        republish(RabbitConfig.DEAD_LETTER_EXCHANGE, message, routingKey, attempts, reason);
    }

    /**
     * Si cette publication échoue elle-même (RabbitMQ injoignable), l'exception remonte au conteneur,
     * qui garde le message d'origine : il n'est jamais acquitté sans avoir été déposé ailleurs.
     */
    private void republish(String exchange, Message source, String routingKey, Integer attempts, String reason) {
        MessageProperties properties = MessagePropertiesBuilder.fromClonedProperties(source.getMessageProperties()).build();
        if (attempts != null) properties.setHeader(RETRY_COUNT_HEADER, attempts);
        if (reason != null) properties.setHeader(FAILURE_REASON_HEADER, reason);
        rabbitTemplate.send(exchange, routingKey, new Message(source.getBody(), properties));
    }
}
