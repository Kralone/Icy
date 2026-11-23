package com.icy.icy_backend.service.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.db.entity.member.MessageTemplate;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.MessageTemplateRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.messaging.DirectMessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class MemberAnnouncementServiceTest {
    private MessageTemplateRepository templateRepository;
    private DirectMessageService directMessages;
    private MemberAnnouncementService service;
    private MessageTemplateService templates;
    private User member;

    @BeforeEach
    void setUp() {
        templateRepository = mock(MessageTemplateRepository.class);
        UserRepository users = mock(UserRepository.class);
        directMessages = mock(DirectMessageService.class);
        templates = new MessageTemplateService(templateRepository, "https://iceforge.fr/images/");
        service = new MemberAnnouncementService(users, templates, directMessages);
        member = new User();
        member.setId(UUID.randomUUID());
        member.setUsername("Un_pseudo_vraiment_tres_long");
        member.setDiscordId("190174996235026433");
        when(users.findById(member.getId())).thenReturn(Optional.of(member));
    }

    @Test
    void aPromotionTooLongOnceThePseudoIsInIsRefusedBeforeSending() {
        MessageTemplate template = new MessageTemplate();
        template.setCode("PROMOTION_ASSOCIE");
        template.setCategory(MessageTemplate.Category.PROMOTION);
        template.setLabel("Promotion Associé");
        template.setBody("{pseudo} ".repeat(150));
        when(templateRepository.findById("PROMOTION_ASSOCIE")).thenReturn(Optional.of(template));

        assertThatThrownBy(() -> service.announce(member.getId(), "PROMOTION_ASSOCIE", UUID.randomUUID(), "Kralone"))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("2000");
        verifyNoInteractions(directMessages);
    }

    @Test
    void anEmptyTemplateUpdateIsABadRequest() {
        assertThatThrownBy(() -> templates.update("PROMOTION_ASSOCIE", (MemberActivityDtos.TemplateUpdate) null, "Kralone"))
                .isInstanceOf(BadRequestException.class);
    }
}
