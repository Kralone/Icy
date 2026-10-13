package com.icy.icy_backend.security;

import com.icy.icy_backend.controller.event.BotEventParticipationController;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.messaging.DiscordEventParticipationListener;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.service.operation.OperationLock;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le point d'accès de réponse réservé au bot, à travers la vraie chaîne de sécurité :
 * configuration de l'application, filtre de la clé du bot, filtre JWT et contrôle du rôle.
 * Seuls les dépôts de données sont simulés.
 */
@WebMvcTest(controllers = BotEventParticipationController.class)
@Import({BotEventParticipationSecurityTest.WebSecurity.class, SecurityConfig.class, BotApiKeyAuthenticationFilter.class, JwtAuthenticationFilter.class, DiscordEventParticipationListener.class})
@TestPropertySource(properties = "bot.api-key=cle-de-test-du-bot")
class BotEventParticipationSecurityTest {
    /** L'application reçoit cette activation de Spring Boot ; un test de tranche web doit la déclarer. */
    @org.springframework.boot.test.context.TestConfiguration
    @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
    static class WebSecurity {}

    private static final String PATH = "/api/events/bot/participation";
    private static final String KEY = "cle-de-test-du-bot";

    @Autowired private org.springframework.web.context.WebApplicationContext context;
    private MockMvc mockMvc;
    @Autowired private BotEventParticipationController controller;

    /** Seule la chaîne de sécurité de l'application est posée devant le contrôleur, comme en service. */
    @org.junit.jupiter.api.BeforeEach
    void buildMockMvcBehindTheSecurityChain() {
        mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class))
                .build();
    }
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private UserService userService;
    @MockitoBean private EventRepository events;
    @MockitoBean private UserRepository users;
    @MockitoBean private EventParticipationRepository participations;
    @MockitoBean private EventPublisher publisher;
    @MockitoBean private OperationAssignmentRepository assignments;
    @MockitoBean private OperationAssignmentRequestRepository requests;
    @MockitoBean private OperationRepository operations;
    @MockitoBean private com.icy.icy_backend.service.common.MessageService messageService;

    private Event classicEvent() {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setActivityType(ActivityType.EVENT);
        event.setEndDateTime(LocalDateTime.now(OperationLock.ZONE).minusHours(1));
        when(events.findById(event.getId())).thenReturn(Optional.of(event));
        return event;
    }

    private MockHttpServletRequestBuilder answer(UUID eventId, String discordUserId) {
        return post(PATH).contentType(MediaType.APPLICATION_JSON)
                .content("{\"eventId\":\"" + eventId + "\",\"discordUserId\":\"" + discordUserId + "\",\"username\":\"pilote\",\"status\":1}");
    }

    @Test
    void aRequestWithoutBotKeyIsRefused() throws Exception {
        Event event = classicEvent();

        mockMvc.perform(answer(event.getId(), "discord-1")).andExpect(status().isUnauthorized());

        verifyNoInteractions(users, participations, publisher);
    }

    @Test
    void aWrongBotKeyIsRefused() throws Exception {
        Event event = classicEvent();

        mockMvc.perform(answer(event.getId(), "discord-1").header("Authorization", "Bot mauvaise-cle")).andExpect(status().isUnauthorized());

        verifyNoInteractions(users, participations, publisher);
    }

    @Test
    void anOrdinaryMemberWithAValidJwtIsRefused() throws Exception {
        Event event = classicEvent();
        User member = new User();
        member.setId(UUID.randomUUID());
        member.setUsername("membre");
        when(jwtUtil.validateToken("jeton-membre")).thenReturn(true);
        when(jwtUtil.getSubjectFromToken("jeton-membre")).thenReturn("membre");
        when(jwtUtil.extractRoles("jeton-membre")).thenReturn(List.of("USER"));
        when(userService.getByUsername("membre")).thenReturn(member);

        // Ce qui compte est le refus, quel que soit le maillon qui le prononce : aujourd'hui le filtre du bot (401),
        // demain peut-être le contrôle du rôle (403). Dans les deux cas, rien n'est lu ni écrit.
        mockMvc.perform(answer(event.getId(), "discord-1").header("Authorization", "Bearer jeton-membre")).andExpect(status().is4xxClientError());

        verifyNoInteractions(users, participations, publisher);
    }

    /** Seconde barrière, indépendante du filtre : appelé directement, le contrôleur n'accepte que le rôle du bot. */
    @Test
    void theControllerItselfRefusesAnyoneButTheBot() {
        Event event = classicEvent();
        var request = new BotEventParticipationController.Request(event.getId(), "discord-9", "pilote", 1);
        when(users.findByDiscordId("discord-9")).thenReturn(Optional.empty());
        try {
            for (String role : List.of("ROLE_USER", "ROLE_OFFICIER", "ROLE_ADMIN")) {
                org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                        new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("membre", null,
                                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(role))));
                org.assertj.core.api.Assertions.assertThatThrownBy(() -> controller.record(request))
                        .as(role).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            }
            verifyNoInteractions(users, participations, publisher);

            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("iceforge-bot", null,
                            List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_BOT"))));
            org.assertj.core.api.Assertions.assertThat(controller.record(request).getBody()).containsEntry("outcome", "UNKNOWN_USER");
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    void theBotIsAllowedAndAKnownAccountIsRecorded() throws Exception {
        Event event = classicEvent();
        User member = new User();
        member.setId(UUID.randomUUID());
        when(users.findByDiscordId("discord-1")).thenReturn(Optional.of(member));
        when(participations.findByEventAndUser(event, member)).thenReturn(Optional.empty());

        mockMvc.perform(answer(event.getId(), "discord-1").header("Authorization", "Bot " + KEY))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("RECORDED"));

        verify(participations).save(any(EventParticipation.class));
    }

    @Test
    void anUnknownOrInactiveDiscordAccountRecordsNothing() throws Exception {
        Event event = classicEvent();
        // Le dépôt ne rend que les comptes actifs : un compte inconnu et un compte inactif se présentent ainsi.
        when(users.findByDiscordId("discord-9")).thenReturn(Optional.empty());

        mockMvc.perform(answer(event.getId(), "discord-9").header("Authorization", "Bot " + KEY))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("UNKNOWN_USER"));

        verify(participations, never()).save(any());
        verifyNoInteractions(publisher);
    }

    @Test
    void aPublishedOperationPastItsEndRecordsNothingEvenBeforeTheFinishedFlag() throws Exception {
        Event event = classicEvent();
        event.setActivityType(ActivityType.OPERATION);
        event.setFinished(false);
        when(operations.findById(event.getId())).thenReturn(Optional.of(Operation.builder().eventId(event.getId()).event(event).publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));

        mockMvc.perform(answer(event.getId(), "discord-1").header("Authorization", "Bot " + KEY))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("OPERATION_CLOSED"));

        verify(participations, never()).save(any());
        verifyNoInteractions(users, publisher);
    }
}
