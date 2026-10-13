package com.icy.securityhttp;

import com.icy.icy_backend.controller.operation.OperationController;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.BotApiKeyAuthenticationFilter;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.event.EventService;
import com.icy.icy_backend.service.operation.OperationAssignmentService;
import com.icy.icy_backend.service.operation.OperationCoordinationService;
import com.icy.icy_backend.service.operation.OperationCrewService;
import com.icy.icy_backend.service.operation.OperationFleetService;
import com.icy.icy_backend.service.operation.OperationGroupService;
import com.icy.icy_backend.service.operation.OperationLock;
import com.icy.icy_backend.service.operation.OperationOrganizationService;
import com.icy.icy_backend.service.operation.OperationService;
import com.icy.icy_backend.service.operation.OperationShipRequirementService;
import com.icy.icy_backend.service.operation.OperationShipService;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Refus d'accès à travers un vrai serveur : Tomcat, la configuration de sécurité de l'application, le filtre JWT,
 * le contrôle des rôles et le traitement global des erreurs. Seuls les accès aux données sont simulés.
 *
 * Un test MockMvc ne voit pas ce défaut : c'est le renvoi interne du conteneur vers la page d'erreur qui
 * transformait un 403 en 401, et MockMvc ne fait pas ce renvoi.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, classes = AccessDeniedOverHttpTest.App.class, properties = {
        "bot.api-key=cle-de-test-du-bot",
        "spring.main.banner-mode=off",
        "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,"
                + "org.springframework.boot.amqp.autoconfigure.RabbitAutoConfiguration"
})
class AccessDeniedOverHttpTest {
    /**
     * Hors du paquet de l'application : ni sa recherche de configuration ni son balayage de composants ne la voient,
     * les autres tests gardent donc la leur.
     */
    @org.springframework.boot.SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({SecurityConfig.class, JwtAuthenticationFilter.class, BotApiKeyAuthenticationFilter.class, GlobalExceptionHandler.class,
            MessageService.class, OperationController.class, OperationShipService.class, Probe.class})
    static class App {}

    @RestController
    static class Probe {
        @GetMapping("/api/probe/member") String member() { return "ok"; }
        @GetMapping("/api/probe/admin") @PreAuthorize("hasRole('ADMIN')") String admin() { return "ok"; }
        /** Refus décidé dans un service, comme pour un responsable hors de sa délégation. */
        @GetMapping("/api/probe/delegation") String delegation() { throw new AccessDeniedException("Groupe hors de votre délégation"); }
    }

    @LocalServerPort private int port;

    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private UserService userService;
    @MockitoBean private EventRepository eventRepository;
    @MockitoBean private OperationRepository operationRepository;
    @MockitoBean private OperationService operationService;
    @MockitoBean private OperationGroupRepository operationGroupRepository;
    @MockitoBean private OperationAssignmentService assignmentService;
    @MockitoBean private OperationGroupService groupService;
    @MockitoBean private OperationAssignmentRequestRepository requestRepository;
    @MockitoBean private EventService eventService;
    @MockitoBean private OperationFleetService fleetService;
    @MockitoBean private OperationShipRequirementService shipRequirementService;
    @MockitoBean private OperationOrganizationService organizationService;
    @MockitoBean private OperationCoordinationService coordinationService;
    @MockitoBean private OperationCrewService crewService;
    @MockitoBean private UserShipRepository hangar;
    @MockitoBean private OperationShipProposalRepository proposals;
    @MockitoBean private EventParticipationRepository participations;
    @MockitoBean private OperationShipRequirementRepository requirements;
    @MockitoBean private OperationLock operationLock;

    private final HttpClient client = HttpClient.newHttpClient();
    private final UUID operationId = UUID.randomUUID();
    private final UUID pilotId = UUID.randomUUID();
    private OperationShipProposal proposal;

    @BeforeEach
    void knownTokens() {
        token("jeton-membre", "membre", "USER");
        token("jeton-officier", "officier", "OFFICIER");
        token("jeton-admin", "admin", "ADMIN");
        proposal = OperationShipProposal.builder().id(UUID.randomUUID()).operationEventId(operationId).shipId(42L).ownerUserId(UUID.randomUUID()).build();
        when(proposals.findByIdAndOperationEventId(proposal.getId(), operationId)).thenReturn(Optional.of(proposal));
        when(participations.existsByEvent_IdAndUser_IdAndStatus(operationId, pilotId, 1)).thenReturn(true);
    }

    private void token(String token, String username, String role) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        when(jwtUtil.validateToken(token)).thenReturn(true);
        when(jwtUtil.getSubjectFromToken(token)).thenReturn(username);
        when(jwtUtil.extractRoles(token)).thenReturn(List.of(role));
        when(userService.getByUsername(username)).thenReturn(user);
    }

    private HttpResponse<String> call(String method, String path, String token) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .method(method, HttpRequest.BodyPublishers.noBody());
        if (token != null) request.header("Authorization", "Bearer " + token);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void aRequestWithoutIdentityIsStillUnauthorized() throws Exception {
        assertThat(call("GET", "/api/probe/member", null).statusCode()).isEqualTo(401);
        assertThat(call("GET", "/api/probe/admin", null).statusCode()).isEqualTo(401);
        assertThat(call("GET", "/api/probe/member", "jeton-inconnu").statusCode()).isEqualTo(401);
        assertThat(call("PUT", pilotPath(pilotId), null).statusCode()).isEqualTo(401);
    }

    @Test
    void anAuthenticatedUserWithoutTheRoleIsForbiddenNotLoggedOut() throws Exception {
        assertThat(call("GET", "/api/probe/member", "jeton-membre").statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/probe/admin", "jeton-membre").statusCode()).isEqualTo(403);
        assertThat(call("GET", "/api/probe/admin", "jeton-officier").statusCode()).isEqualTo(403);
        assertThat(call("GET", "/api/probe/admin", "jeton-admin").statusCode()).isEqualTo(200);
    }

    @Test
    void aRefusalDecidedInAServiceIsForbiddenToo() throws Exception {
        HttpResponse<String> refused = call("GET", "/api/probe/delegation", "jeton-membre");
        assertThat(refused.statusCode()).isEqualTo(403);
        // La page d'erreur ne répète ni le message de l'exception ni une trace.
        assertThat(refused.body()).doesNotContain("délégation").doesNotContain("AccessDeniedException").doesNotContain("\"trace\"").doesNotContain("at com.icy");
        assertThat(call("GET", "/api/probe/delegation", null).statusCode()).isEqualTo(401);
    }

    @Test
    void theErrorPageItselfStaysProtectedFromDirectRequests() throws Exception {
        assertThat(call("GET", "/error", null).statusCode()).isEqualTo(401);
        HttpResponse<String> direct = call("GET", "/error", "jeton-membre");
        assertThat(direct.body()).doesNotContain("\"trace\"").doesNotContain("Exception");
    }

    @Test
    void routesWithoutIdentityNeverRevealWhetherTheyExist() throws Exception {
        assertThat(call("GET", "/api/probe/absente", null).statusCode()).isEqualTo(401);
        assertThat(call("DELETE", "/api/probe/member", null).statusCode()).isEqualTo(401);
        HttpResponse<String> anonymous = call("GET", "/api/probe/admin", null);
        assertThat(anonymous.body()).doesNotContain("\"trace\"").doesNotContain("Exception");
    }

    @Test
    void theBotEndpointsStayClosedWithoutTheBotKey() throws Exception {
        assertThat(call("POST", "/api/events/bot/participation", null).statusCode()).isEqualTo(401);
        assertThat(call("POST", "/api/events/bot/participation", "jeton-admin").statusCode()).isEqualTo(401);
        HttpRequest wrongKey = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/events/bot/participation"))
                .header("Authorization", "Bot mauvaise-cle").POST(HttpRequest.BodyPublishers.noBody()).build();
        assertThat(client.send(wrongKey, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
    }

    @Test
    void onlyOrganizersSetChangeAndRemoveAShipPilot() throws Exception {
        HttpResponse<String> refused = call("PUT", pilotPath(pilotId), "jeton-membre");
        assertThat(refused.statusCode()).isEqualTo(403);
        assertThat(proposal.getPilotUserId()).isNull();
        verify(proposals, never()).save(any());

        HttpResponse<String> set = call("PUT", pilotPath(pilotId), "jeton-officier");
        assertThat(set.statusCode()).isEqualTo(200);
        assertThat(set.body()).contains("\"code\":2052");
        assertThat(proposal.getPilotUserId()).isEqualTo(pilotId);

        UUID other = UUID.randomUUID();
        when(participations.existsByEvent_IdAndUser_IdAndStatus(operationId, other, 1)).thenReturn(true);
        assertThat(call("PUT", pilotPath(other), "jeton-admin").statusCode()).isEqualTo(200);
        assertThat(proposal.getPilotUserId()).isEqualTo(other);

        assertThat(call("PUT", pilotPath(null), "jeton-officier").statusCode()).isEqualTo(200);
        assertThat(proposal.getPilotUserId()).isNull();
        verify(proposals, org.mockito.Mockito.times(3)).save(proposal);
    }

    @Test
    void aPilotWhoIsNotPresentIsRefusedWithoutAServerError() throws Exception {
        UUID absent = UUID.randomUUID();
        HttpResponse<String> response = call("PUT", pilotPath(absent), "jeton-officier");
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).contains("inscrit Présent");
        assertThat(proposal.getPilotUserId()).isNull();
        verify(proposals, never()).save(any());
    }

    private String pilotPath(UUID pilot) {
        return "/api/operations/" + operationId + "/ships/proposals/" + proposal.getId() + "/pilot" + (pilot == null ? "" : "?pilotUserId=" + pilot);
    }
}
