package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Réponses du bot après un message privé : envoyé, ou la raison de l'échec. */
@Component
@RequiredArgsConstructor
public class DirectMessageResultListener {
    private final DirectMessageService directMessages;

    @RabbitListener(queues = RabbitConfig.DIRECT_MESSAGE_RESULT_QUEUE, errorHandler = "inboundMessageErrorHandler")
    public void handle(@Payload Map<String, Object> payload) {
        Object deliveryId = payload.get("deliveryId");
        Object status = payload.get("status");
        if (deliveryId == null || status == null) throw new IllegalArgumentException("Résultat de message privé incomplet");
        Object reason = payload.get("reason");
        directMessages.recordResult(UUID.fromString(String.valueOf(deliveryId)),
                DirectMessage.Status.valueOf(String.valueOf(status)),
                reason == null ? null : String.valueOf(reason));
    }
}
