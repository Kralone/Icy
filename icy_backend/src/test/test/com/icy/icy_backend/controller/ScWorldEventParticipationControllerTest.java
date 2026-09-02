package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.scworldevent.ScWorldEventParticipationController;
import com.icy.icy_backend.controller.dto.scworldevent.UpsertScWorldEventParticipationDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventParticipationDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.scworldevent.ScWorldEventParticipationService;
import com.icy.icy_backend.service.common.MessageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@WebMvcTest(controllers = ScWorldEventParticipationController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class ScWorldEventParticipationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ScWorldEventParticipationService service;

    @MockitoBean
    private MessageService messageService;

    @Test
    void scWorldEventParticipationEndpointsReturnOk() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();

        ScWorldEventParticipation participation = new ScWorldEventParticipation();
        participation.setPoints(objectMapper.readTree("{\"cargo\":25}"));
        when(service.getAllForUser(eq(userId))).thenReturn(List.of(participation));
        when(service.getForUserAndEventOrThrow(eq(eventId), eq(userId))).thenReturn(new ScWorldEventParticipation());
        when(service.upsert(eq(eventId), eq(userId), any(UpsertScWorldEventParticipationDTO.class)))
                .thenReturn(new ScWorldEventParticipation());
        when(service.upsert(eq(eventId), eq(userId), any(UpsertScWorldEventParticipationDTO.class)))
                .thenReturn(new ScWorldEventParticipation());
        when(service.upsert(eq(eventId), eq("discord"), any(UpsertScWorldEventParticipationDTO.class)))
                .thenReturn(new ScWorldEventParticipation());
        when(service.getLeaderboard(eq(eventId), eq(0), eq(50)))
                .thenReturn(new PageImpl<>(List.of(new ScWorldEventParticipation())));

        UpsertScWorldEventParticipationDTO dto = new UpsertScWorldEventParticipationDTO();

        mockMvc.perform(get("/api/sc-world-events/participations/me")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].points.cargo").value(25))
                .andExpect(jsonPath("$[0].points.object").doesNotExist());
        mockMvc.perform(get("/api/sc-world-events/" + eventId + "/participation/me")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation/me")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                        .with(TestAuth.user(userId, "OFFICIER"))
                        .param("userId", userId.toString())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .param("discordId", "discord")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/event/" + eventId + "/leaderboard")
                        .param("page", "0")
                        .param("size", "50"))
                .andExpect(status().isOk());
    }

    @Test
    void modifyingAnotherUsersParticipationRequiresExplicitStaffRole() throws Exception {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UpsertScWorldEventParticipationDTO dto = new UpsertScWorldEventParticipationDTO();
        when(service.upsert(eq(eventId), eq(targetId), any(UpsertScWorldEventParticipationDTO.class)))
                .thenReturn(new ScWorldEventParticipation());

        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                        .with(TestAuth.user(actorId, "USER"))
                        .param("userId", targetId.toString())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());

        for (String role : List.of("OFFICIER", "ADMIN")) {
            mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                            .with(TestAuth.user(actorId, role))
                            .param("userId", targetId.toString())
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(dto)))
                    .andExpect(status().isOk());
        }
    }
}




