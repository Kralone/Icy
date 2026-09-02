package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.icelink.IceLinkBlockController;
import com.icy.icy_backend.controller.dto.icelink.IceLinkBlockDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.icelink.IceLinkBlockService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = IceLinkBlockController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class IceLinkBlockControllerTest {

    private static final UUID ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000014");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private IceLinkBlockService service;

    @MockitoBean
    private MessageService messageService;

    @Test
    void iceLinkBlockEndpointsReturnOk() throws Exception {
        when(service.create(any(IceLinkBlockDTO.class))).thenReturn(new IceLinkBlockDTO());
        when(service.update(eq(1L), any(IceLinkBlockDTO.class))).thenReturn(new IceLinkBlockDTO());
        doNothing().when(service).delete(eq(1L));
        when(service.getAll()).thenReturn(List.of(new IceLinkBlockDTO()));

        mockMvc.perform(post("/api/icelink/blocks")
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new IceLinkBlockDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/icelink/blocks/1")
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new IceLinkBlockDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/icelink/blocks/1").with(TestAuth.user(ACTOR_ID, "OFFICIER")))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/icelink/blocks"))
                .andExpect(status().isOk());
    }

    @Test
    void mutationsRejectRegularUsersButReadRemainsAvailable() throws Exception {
        String body = objectMapper.writeValueAsString(new IceLinkBlockDTO());

        mockMvc.perform(post("/api/icelink/blocks").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/icelink/blocks/1").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/icelink/blocks/1").with(TestAuth.user(ACTOR_ID, "USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/icelink/blocks").with(TestAuth.user(ACTOR_ID, "USER")))
                .andExpect(status().isOk());
    }
}




