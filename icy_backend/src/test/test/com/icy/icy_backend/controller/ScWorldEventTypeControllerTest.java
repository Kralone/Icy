package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.scworldevent.ScWorldEventTypeController;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventTypeDTO;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.scworldevent.ScWorldEventTypeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
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
@SuppressWarnings("removal")
class ScWorldEventTypeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ScWorldEventTypeService service;

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
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateScWorldEventTypeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/sc-world-event-types/type")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UpdateScWorldEventTypeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/sc-world-event-types/type"))
                .andExpect(status().isOk());
    }
}




