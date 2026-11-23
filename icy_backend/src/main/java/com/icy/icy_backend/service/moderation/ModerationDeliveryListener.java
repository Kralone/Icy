package com.icy.icy_backend.service.moderation;

import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.messaging.DirectMessageResultEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Le bot a répondu : l'avertissement ou la décision affiche « reçu » ou la raison du refus. */
@Component
@RequiredArgsConstructor
public class ModerationDeliveryListener {
    private final MemberWarningService warnings;

    @EventListener
    public void onResult(DirectMessageResultEvent event) {
        if (!DirectMessageModerationMessenger.ORIGIN.equals(event.origin())) return;
        warnings.recordDelivery(event.deliveryId(), event.status() == DirectMessage.Status.SENT, event.reason());
    }
}
