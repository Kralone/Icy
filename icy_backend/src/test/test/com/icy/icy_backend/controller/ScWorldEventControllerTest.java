package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.scworldevent.ScWorldEventController;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.scworldevent.ScWorldEventService;
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
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ScWorldEventController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class ScWorldEventControllerTest {

    private static final UUID EVENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ScWorldEventService service;

    @MockitoBean
    private MessageService messageService;

    @Test
    void scWorldEventEndpointsReturnOk() throws Exception {
        when(service.getAll(eq(0), eq(30))).thenReturn(new PageImpl<>(List.of(sampleEvent())));
        when(service.getPlayable(eq(0), eq(30))).thenReturn(new PageImpl<>(List.of(sampleEvent())));
        when(service.getHistory(eq(0), eq(30))).thenReturn(new PageImpl<>(List.of(sampleEvent())));
        when(service.getCurrentOptional()).thenReturn(Optional.of(sampleEvent()));
        when(service.hasCurrentEvent()).thenReturn(true);
        when(service.getByIdOrThrow(any(UUID.class))).thenReturn(sampleEvent());
        when(service.create(any(CreateScWorldEventDTO.class))).thenReturn(sampleEvent());
        when(service.update(any(UUID.class), any(UpdateScWorldEventDTO.class))).thenReturn(sampleEvent());
        doNothing().when(service).delete(any(UUID.class));

        mockMvc.perform(get("/api/sc-world-events")
                        .param("page", "0")
                        .param("size", "30"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/playable")
                        .param("page", "0")
                        .param("size", "30"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/history")
                        .param("page", "0")
                        .param("size", "30"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/current"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/current/exists"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-events/00000000-0000-0000-0000-000000000001"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/sc-world-events")
                        .with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateScWorldEventDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/00000000-0000-0000-0000-000000000001")
                        .with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UpdateScWorldEventDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/sc-world-events/00000000-0000-0000-0000-000000000001")
                        .with(TestAuth.user(ACTOR_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void mutationsRequireAdminRole() throws Exception {
        when(service.create(any(CreateScWorldEventDTO.class))).thenReturn(sampleEvent());
        when(service.update(eq(EVENT_ID), any(UpdateScWorldEventDTO.class))).thenReturn(sampleEvent());
        doNothing().when(service).delete(EVENT_ID);
        String createBody = objectMapper.writeValueAsString(new CreateScWorldEventDTO());
        String updateBody = objectMapper.writeValueAsString(new UpdateScWorldEventDTO());

        for (String role : List.of("USER", "OFFICIER")) {
            mockMvc.perform(post("/api/sc-world-events").with(TestAuth.user(ACTOR_ID, role))
                            .contentType("application/json").content(createBody))
                    .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/sc-world-events/" + EVENT_ID).with(TestAuth.user(ACTOR_ID, role))
                            .contentType("application/json").content(updateBody))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/sc-world-events/" + EVENT_ID).with(TestAuth.user(ACTOR_ID, role)))
                    .andExpect(status().isForbidden());
        }

        mockMvc.perform(post("/api/sc-world-events").with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json").content(createBody))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-events/" + EVENT_ID).with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json").content(updateBody))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/sc-world-events/" + EVENT_ID).with(TestAuth.user(ACTOR_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    private static ScWorldEvent sampleEvent() {
        ScWorldEventType type = new ScWorldEventType();
        type.setName("type");
        ScWorldEvent event = new ScWorldEvent();
        event.setId(UUID.randomUUID());
        event.setTitle("title");
        event.setDescription("desc");
        event.setStartAt(Instant.now());
        event.setCreatedAt(Instant.now());
        event.setType(type);
        event.setGallery("[]");
        return event;
    }
}




