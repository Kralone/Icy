package com.icy.icy_backend.messaging;

import com.icy.icy_backend.service.operation.OperationLock;
import com.icy.icy_backend.config.RabbitConfig;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.DirectMessageRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Messages privés envoyés par le bot Discord : rappels, promotions, avertissements.
 * <p>
 * Chaque envoi est enregistré (PENDING), puis confié au bot après la validation de la transaction appelante :
 * un envoi annulé avec sa transaction ne part jamais. Le bot répond sur {@link RabbitConfig#DIRECT_MESSAGE_RESULT_KEY} ;
 * le résultat est enregistré puis diffusé en {@link DirectMessageResultEvent}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DirectMessageService {
    /** Limites Discord : 2000 caractères pour un message, 4096 pour la description d'une carte. */
    public static final int CONTENT_LIMIT = 2000;
    static final String NO_ANSWER = "no_answer";
    static final int DESCRIPTION_LIMIT = 4096;
    /** Sans réponse du bot après ce délai (bot arrêté, message en file morte), l'envoi est noté en échec. */
    static final Duration ANSWER_TIMEOUT = Duration.ofMinutes(30);
    private static final Pattern MEDIA_NAME = Pattern.compile("^[A-Za-z0-9._-]{1,200}$");

    private final DirectMessageRepository messages;
    private final MessagePublisher publisher;
    private final ApplicationEventPublisher events;

    /** Carte colorée, affichée à la place du texte ou sous lui. color : entier RVB (0xRRGGBB). */
    public record Embed(String title, String description, Integer color, String footer) {
    }

    /**
     * Un message à envoyer. content ou embed est obligatoire. mediaFile : nom d'un fichier de la bibliothèque d'images,
     * joint au message. reference : identifiant propre à l'appelant, rendu avec le résultat.
     */
    public record Request(User recipient, String origin, String reference, String content, Embed embed,
                          String mediaFile, UUID requestedBy) {
    }

    @Transactional
    public DirectMessage send(Request request) {
        validate(request);
        DirectMessage message = messages.save(DirectMessage.builder()
                .id(UUID.randomUUID())
                .userId(request.recipient().getId())
                .origin(request.origin())
                .reference(request.reference())
                .content(blankToNull(request.content()))
                .embedTitle(request.embed() == null ? null : request.embed().title())
                .mediaFile(blankToNull(request.mediaFile()))
                .requestedBy(request.requestedBy())
                .requestedAt(LocalDateTime.now(OperationLock.ZONE))
                .status(DirectMessage.Status.PENDING)
                .build());

        Map<String, Object> payload = new HashMap<>();
        payload.put("deliveryId", message.getId().toString());
        payload.put("discordId", request.recipient().getDiscordId());
        payload.put("origin", request.origin());
        payload.put("reference", request.reference());
        payload.put("content", message.getContent());
        payload.put("mediaFile", message.getMediaFile());
        if (request.embed() != null) {
            Map<String, Object> embed = new HashMap<>();
            embed.put("title", request.embed().title());
            embed.put("description", request.embed().description());
            embed.put("color", request.embed().color());
            embed.put("footer", request.embed().footer());
            payload.put("embed", embed);
        }
        afterCommit(() -> publisher.publish(RabbitConfig.EXCHANGE, RabbitConfig.DIRECT_MESSAGE_SEND_KEY, payload));
        return message;
    }

    /**
     * Réponse du bot. Un envoi inconnu (supprimé avec son membre) ou déjà conclu est ignoré, sauf une confirmation
     * tardive d'un envoi que le délai avait noté en échec : Discord l'a bien remis.
     */
    @Transactional
    public void recordResult(UUID deliveryId, DirectMessage.Status status, String reason) {
        if (deliveryId == null || status == null || status == DirectMessage.Status.PENDING) {
            throw new IllegalArgumentException("Résultat de message privé invalide");
        }
        messages.findById(deliveryId).ifPresentOrElse(message -> {
            boolean lateConfirmation = message.getStatus() == DirectMessage.Status.FAILED && NO_ANSWER.equals(message.getReason())
                    && status == DirectMessage.Status.SENT;
            if (message.getStatus() != DirectMessage.Status.PENDING && !lateConfirmation) return;
            complete(message, status, reason);
        }, () -> log.warn("Résultat d'un message privé inconnu ignoré ({})", deliveryId));
    }

    /** Envois restés sans réponse : notés en échec pour que l'officier le voie et puisse relancer. */
    @Scheduled(fixedDelayString = "${iceforge.direct-messages.sweep-ms:600000}", initialDelayString = "${iceforge.direct-messages.sweep-ms:600000}")
    @Transactional
    public void expireUnanswered() {
        for (DirectMessage message : messages.findByStatusAndRequestedAtBefore(DirectMessage.Status.PENDING, LocalDateTime.now(OperationLock.ZONE).minus(ANSWER_TIMEOUT))) {
            complete(message, DirectMessage.Status.FAILED, NO_ANSWER);
        }
    }

    private void complete(DirectMessage message, DirectMessage.Status status, String reason) {
        message.setStatus(status);
        message.setReason(reason == null ? null : reason.substring(0, Math.min(40, reason.length())));
        message.setCompletedAt(LocalDateTime.now(OperationLock.ZONE));
        messages.save(message);
        events.publishEvent(new DirectMessageResultEvent(message.getId(), message.getUserId(), message.getOrigin(),
                message.getReference(), status, message.getReason()));
    }

    private static void validate(Request request) {
        if (request == null || request.recipient() == null || request.recipient().getId() == null) {
            throw new BadRequestException("Destinataire du message manquant.");
        }
        if (request.recipient().getDiscordId() == null || !request.recipient().getDiscordId().matches("\\d{5,25}")) {
            throw new BadRequestException(request.recipient().getUsername() + " n'a pas d'identifiant Discord valide.");
        }
        if (request.origin() == null || request.origin().isBlank() || request.origin().length() > 24) {
            throw new IllegalArgumentException("Origine du message invalide");
        }
        boolean hasContent = request.content() != null && !request.content().isBlank();
        boolean hasEmbed = request.embed() != null && ((request.embed().title() != null && !request.embed().title().isBlank())
                || (request.embed().description() != null && !request.embed().description().isBlank()));
        if (!hasContent && !hasEmbed) throw new BadRequestException("Le message est vide.");
        if (hasContent && request.content().length() > CONTENT_LIMIT) {
            throw new BadRequestException("Le message dépasse " + CONTENT_LIMIT + " caractères, la limite de Discord.");
        }
        if (hasEmbed && request.embed().description() != null && request.embed().description().length() > DESCRIPTION_LIMIT) {
            throw new BadRequestException("La carte dépasse " + DESCRIPTION_LIMIT + " caractères, la limite de Discord.");
        }
        if (request.mediaFile() != null && !request.mediaFile().isBlank() && !MEDIA_NAME.matcher(request.mediaFile()).matches()) {
            throw new BadRequestException("Nom de fichier d'image invalide.");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
