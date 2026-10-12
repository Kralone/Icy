package com.icy.icy_backend.integration;

import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.service.operation.OperationAssignmentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Opt-in end-to-end capacity race against the local PostgreSQL instance. */
@EnabledIfSystemProperty(named = "iceforge.integration", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc(addFilters = false)
class OperationAssignmentCapacityIntegrationIT {
    private static final UUID USER_ONE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID USER_TWO = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID USER_THREE = UUID.fromString("10000000-0000-0000-0000-000000000003");

    @Autowired JdbcTemplate jdbc;
    @Autowired OperationAssignmentService assignments;
    @Autowired MockMvc mockMvc;

    private UUID operationId;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getProperty("iceforge.jdbc.url", "jdbc:postgresql://localhost:15432/iceforgedb"));
        registry.add("spring.datasource.username", () -> System.getProperty("iceforge.jdbc.user", "iceforge"));
        registry.add("spring.datasource.password", () -> System.getProperty("iceforge.jdbc.password", "iceforge"));
        registry.add("spring.flyway.enabled", () -> false);
        registry.add("JWT_SECRET", () -> "CHANGE_ME_LOCAL_JWT_SECRET_32_CHARS_MINIMUM");
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        if (operationId != null) jdbc.update("DELETE FROM events.events WHERE id = ?", operationId);
    }

    @Test
    void twoConcurrentAssignmentsCannotTakeOneParentPlace() throws Exception {
        operationId = UUID.randomUUID();
        jdbc.update("INSERT INTO events.events (id, type, event_type, title, description, start_date_time, end_date_time, activity_type) VALUES (?, 'OPERATION', 'VALIDATION', 'capacity race', '', ?, ?, 'OPERATION')",
                operationId, LocalDateTime.now().plusHours(1), LocalDateTime.now().plusHours(2));
        jdbc.update("INSERT INTO events.operations (event_id, briefing, publication_status) VALUES (?, '', 'PUBLISHED')", operationId);
        jdbc.update("INSERT INTO events.event_participation (event_id, user_id, status) VALUES (?, ?, 1), (?, ?, 1)", operationId, USER_ONE, operationId, USER_TWO);
        Long parentId = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, name, capacity, assignment_mode, sort_order) VALUES (?, 'Parent plein', 1, 'FREE', 0) RETURNING id", Long.class, operationId);
        Long leafOne = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, parent_id, name, assignment_mode, sort_order) VALUES (?, ?, 'Alpha', 'INHERITED', 0) RETURNING id", Long.class, operationId, parentId);
        Long leafTwo = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, parent_id, name, assignment_mode, sort_order) VALUES (?, ?, 'Bravo', 'INHERITED', 1) RETURNING id", Long.class, operationId, parentId);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = executor.submit(assign(USER_ONE, leafOne));
            Future<Boolean> second = executor.submit(assign(USER_TWO, leafTwo));
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(true, false);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM events.operation_assignments WHERE operation_event_id = ? AND status = 'CONFIRMED'", Long.class, operationId)).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void delegatedResponsibleCanApproveDescendantButNotSibling() {
        operationId = UUID.randomUUID();
        jdbc.update("INSERT INTO events.events (id, type, event_type, title, description, start_date_time, end_date_time, activity_type) VALUES (?, 'OPERATION', 'VALIDATION', 'delegation scope', '', ?, ?, 'OPERATION')",
                operationId, LocalDateTime.now().plusHours(1), LocalDateTime.now().plusHours(2));
        jdbc.update("INSERT INTO events.operations (event_id, briefing, publication_status) VALUES (?, '', 'PUBLISHED')", operationId);
        jdbc.update("INSERT INTO events.event_participation (event_id, user_id, status) VALUES (?, ?, 1), (?, ?, 1)", operationId, USER_ONE, operationId, USER_THREE);
        Long parentId = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, name, assignment_mode, sort_order) VALUES (?, 'Delegated parent', 'VALIDATION', 0) RETURNING id", Long.class, operationId);
        Long childOne = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, parent_id, name, assignment_mode, responsible_user_id, sort_order) VALUES (?, ?, 'Delegated leaf', 'INHERITED', ?, 0) RETURNING id", Long.class, operationId, parentId, USER_TWO);
        Long childTwo = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, parent_id, name, assignment_mode, sort_order) VALUES (?, ?, 'Sibling', 'INHERITED', 1) RETURNING id", Long.class, operationId, parentId);
        UUID descendantRequest = jdbc.queryForObject("INSERT INTO events.operation_assignment_requests (operation_event_id, group_id, user_id) VALUES (?, ?, ?) RETURNING id", UUID.class, operationId, childOne, USER_ONE);
        UUID siblingRequest = jdbc.queryForObject("INSERT INTO events.operation_assignment_requests (operation_event_id, group_id, user_id) VALUES (?, ?, ?) RETURNING id", UUID.class, operationId, childTwo, USER_THREE);
        try {
            asUser(USER_TWO);
            assignments.decide(descendantRequest, true);
            assertThat(jdbc.queryForObject("SELECT status FROM events.operation_assignment_requests WHERE id = ?", String.class, descendantRequest)).isEqualTo("APPROVED");
            assertThatThrownBy(() -> assignments.decide(siblingRequest, true))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void failedTransferApprovalKeepsPendingRequestAndPreviousAssignment() {
        operationId = UUID.randomUUID();
        jdbc.update("INSERT INTO events.events (id, type, event_type, title, description, start_date_time, end_date_time, activity_type) VALUES (?, 'OPERATION', 'VALIDATION', 'transfer rollback', '', ?, ?, 'OPERATION')",
                operationId, LocalDateTime.now().plusHours(1), LocalDateTime.now().plusHours(2));
        jdbc.update("INSERT INTO events.operations (event_id, briefing, publication_status) VALUES (?, '', 'PUBLISHED')", operationId);
        Long previousGroup = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, name, assignment_mode, sort_order) VALUES (?, 'Ancienne place', 'FREE', 0) RETURNING id", Long.class, operationId);
        Long fullParent = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, name, capacity, assignment_mode, sort_order) VALUES (?, 'Cible pleine', 0, 'VALIDATION', 1) RETURNING id", Long.class, operationId);
        Long targetGroup = jdbc.queryForObject("INSERT INTO events.operation_groups (operation_event_id, parent_id, name, assignment_mode, sort_order) VALUES (?, ?, 'Cible', 'INHERITED', 0) RETURNING id", Long.class, operationId, fullParent);
        UUID requestId = jdbc.queryForObject("INSERT INTO events.operation_assignment_requests (operation_event_id, group_id, user_id) VALUES (?, ?, ?) RETURNING id", UUID.class, operationId, targetGroup, USER_ONE);
        jdbc.update("INSERT INTO events.operation_assignments (operation_event_id, group_id, user_id, status) VALUES (?, ?, ?, 'CONFIRMED')", operationId, previousGroup, USER_ONE);

        asAdmin();
        assertThatThrownBy(() -> assignments.decide(requestId, true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Groupe complet");
        assertThat(jdbc.queryForObject("SELECT status FROM events.operation_assignment_requests WHERE id = ?", String.class, requestId)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT group_id FROM events.operation_assignments WHERE operation_event_id = ? AND user_id = ?", Long.class, operationId, USER_ONE)).isEqualTo(previousGroup);
    }

    @Test
    void nonOrganizerCannotOpenDraftOperationDeepLink() throws Exception {
        operationId = UUID.randomUUID();
        jdbc.update("INSERT INTO events.events (id, type, event_type, title, description, start_date_time, end_date_time, activity_type) VALUES (?, 'OPERATION', 'VALIDATION', 'draft deep link', '', ?, ?, 'OPERATION')",
                operationId, LocalDateTime.now().plusHours(1), LocalDateTime.now().plusHours(2));
        jdbc.update("INSERT INTO events.operations (event_id, briefing, publication_status) VALUES (?, '', 'DRAFT')", operationId);

        mockMvc.perform(get("/api/operations/{id}", operationId)
                        .with(TestAuth.user(USER_ONE, "USER")))
                .andExpect(status().isNotFound());
    }

    @Test
    void participantCanReadPublishedOperationButCannotOpenEditor() throws Exception {
        operationId = UUID.randomUUID();
        jdbc.update("INSERT INTO events.events (id, type, event_type, title, description, start_date_time, end_date_time, activity_type) VALUES (?, 'OPERATION', 'VALIDATION', 'published deep link', 'briefing', ?, ?, 'OPERATION')",
                operationId, LocalDateTime.now().plusHours(1), LocalDateTime.now().plusHours(2));
        jdbc.update("INSERT INTO events.operations (event_id, briefing, publication_status) VALUES (?, 'briefing', 'PUBLISHED')", operationId);

        mockMvc.perform(get("/api/operations/{id}", operationId)
                        .with(TestAuth.user(USER_ONE, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/operations/{id}/edit", operationId)
                        .with(TestAuth.user(USER_ONE, "USER")))
                .andExpect(status().isForbidden());
    }

    private Callable<Boolean> assign(UUID userId, Long groupId) {
        return () -> {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    new UserAuthDetails(userId, userId.toString(), "password", List.of()), "", List.of()));
            try {
                assignments.assign(operationId, groupId);
                return true;
            } catch (RuntimeException exception) {
                return false;
            } finally {
                SecurityContextHolder.clearContext();
            }
        };
    }

    private void asUser(UUID userId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, userId.toString(), "password", List.of()), "", List.of()));
    }

    private void asAdmin() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(USER_ONE, "admin", "password", List.of()), "", List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
}
