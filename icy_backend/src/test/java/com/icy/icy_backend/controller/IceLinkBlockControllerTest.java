package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.icelink.IceLinkBlockController;
import com.icy.icy_backend.controller.dto.icelink.IceLinkBlockDTO;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.icelink.IceLinkBlockService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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

@WebMvcTest(controllers = IceLinkBlockController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
class IceLinkBlockControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private IceLinkBlockService service;

    @Test
    void iceLinkBlockEndpointsReturnOk() throws Exception {
        when(service.create(any(IceLinkBlockDTO.class))).thenReturn(new IceLinkBlockDTO());
        when(service.update(eq(1L), any(IceLinkBlockDTO.class))).thenReturn(new IceLinkBlockDTO());
        doNothing().when(service).delete(eq(1L));
        when(service.getAll()).thenReturn(List.of(new IceLinkBlockDTO()));

        mockMvc.perform(post("/api/icelink/blocks")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new IceLinkBlockDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/icelink/blocks/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new IceLinkBlockDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/icelink/blocks/1"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/icelink/blocks"))
                .andExpect(status().isOk());
    }
}
