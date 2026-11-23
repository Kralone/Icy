package com.icy.icy_backend.service.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.member.MessageTemplate;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.DirectMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Annonce en message privé d'une promotion, d'une nomination ou de la bienvenue, avec le GIF de son modèle. */
@Service
@RequiredArgsConstructor
public class MemberAnnouncementService {
    public static final String ORIGIN = "PROMOTION";

    private final UserRepository users;
    private final MessageTemplateService templates;
    private final DirectMessageService directMessages;

    @Transactional
    public MemberActivityDtos.DirectMessage announce(UUID userId, String templateCode, UUID requestedBy, String requestedByName) {
        User user = users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable."));
        MessageTemplate template = templates.get(templateCode);
        if (template.getCategory() != MessageTemplate.Category.PROMOTION) {
            throw new BadRequestException("Ce modèle n'est pas une annonce de promotion.");
        }
        DirectMessage message = directMessages.send(new DirectMessageService.Request(user, ORIGIN, template.getCode(),
                MessageTemplateService.render(template.getBody(), user, template.getCode()), null, template.getMediaFile(), requestedBy));
        return new MemberActivityDtos.DirectMessage(message.getId(), ORIGIN, template.getCode(), template.getLabel(), message.getStatus().name(),
                null, message.getRequestedAt(), null, requestedByName);
    }
}
