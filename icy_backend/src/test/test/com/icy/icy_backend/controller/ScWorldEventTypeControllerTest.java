package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.scworldevent.ScWorldEventTypeController;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventTypeDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.scworldevent.ScWorldEventTypeService;
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
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
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

@WebMvcTest(controllers = ScWorldEventTypeController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class ScWorldEventTypeControllerTest {

    private static final UUID ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000003");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ScWorldEventTypeService service;

    @MockitoBean
    private MessageService messageService;

    @Test
    void scWorldEventTypeEndpointsReturnOk() throws Exception {
        when(service.getAll()).thenReturn(List.of(new ScWorldEventType()));
        when(service.getByNameOrThrow(eq("type"))).thenReturn(new ScWorldEventType());
        when(service.create(any(CreateScWorldEventTypeDTO.class))).thenReturn(new ScWorldEventType());
        when(service.update(eq("type"), any(UpdateScWorldEventTypeDTO.class))).thenReturn(new ScWorldEventType());
        doNothing().when(service).delete(eq("type"));

        mockMvc.perform(get("/api/sc-world-event-types"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/sc-world-event-types/type"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/sc-world-event-types")
                        .with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateScWorldEventTypeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-event-types/type")
                        .with(TestAuth.user(ACTOR_ID, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UpdateScWorldEventTypeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/sc-world-event-types/type").with(TestAuth.user(ACTOR_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void typeMutationsRejectNonAdminRoles() throws Exception {
        for (String role : List.of("USER", "OFFICIER")) {
            mockMvc.perform(post("/api/sc-world-event-types")
                            .with(TestAuth.user(ACTOR_ID, role))
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(new CreateScWorldEventTypeDTO())))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/sc-world-event-types/type").with(TestAuth.user(ACTOR_ID, role)))
                    .andExpect(status().isForbidden());
        }
    }
}




