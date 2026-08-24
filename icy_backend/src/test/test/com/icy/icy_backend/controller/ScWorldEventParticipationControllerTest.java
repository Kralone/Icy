package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.scworldevent.ScWorldEventParticipationController;
import com.icy.icy_backend.controller.dto.scworldevent.UpsertScWorldEventParticipationDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventParticipationDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.scworldevent.ScWorldEventParticipationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ScWorldEventParticipationController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class ScWorldEventParticipationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ScWorldEventParticipationService service;

    @Test
    void scWorldEventParticipationEndpointsReturnOk() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();

        when(service.getAllForUser(eq(userId))).thenReturn(List.of(new ScWorldEventParticipation()));
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
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/" + eventId + "/participation/me")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation/me")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                        .param("userId", userId.toString())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + eventId + "/participation")
                        .param("discordId", "discord")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/event/" + eventId + "/leaderboard")
                        .param("page", "0")
                        .param("size", "50"))
                .andExpect(status().isOk());
    }
}




