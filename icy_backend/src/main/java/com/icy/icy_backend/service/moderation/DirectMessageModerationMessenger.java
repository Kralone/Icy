package com.icy.icy_backend.service.moderation;

import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.messaging.DirectMessageService;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Messages de discipline confiés à la brique commune des messages privés du bot. */
@Component
@RequiredArgsConstructor
public class DirectMessageModerationMessenger implements ModerationMessenger {
    public static final String ORIGIN = "WARNING";

    private final DirectMessageService directMessages;

    @Override
    public UUID send(User recipient, ModerationMessage message) {
        DirectMessage sent = directMessages.send(new DirectMessageService.Request(recipient, ORIGIN, null, null,
                new DirectMessageService.Embed(message.title(), message.description(), message.color(), message.footer()),
                null, AuthUtils.getCurrentUserId()));
        return sent.getId();
    }
}
