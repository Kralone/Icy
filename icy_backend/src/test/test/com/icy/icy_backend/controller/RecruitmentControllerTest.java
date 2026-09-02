package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.recruitment.RecruitmentController;
import com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.security.PublicEndpointRateLimiter;
import com.icy.icy_backend.service.recruitment.RecruitmentService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RecruitmentController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class RecruitmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RecruitmentService recruitmentService;

    @MockitoBean
    private PublicEndpointRateLimiter rateLimiter;

    @Test
    void recruitmentEndpointsReturnOk() throws Exception {
        when(recruitmentService.create(any(RecruitmentDTO.class))).thenReturn(new RecruitmentDTO());
        when(recruitmentService.getAll()).thenReturn(List.of(new RecruitmentDTO()));
        when(recruitmentService.getById(eq(1L))).thenReturn(new RecruitmentDTO());
        when(recruitmentService.update(eq(1L), any(RecruitmentDTO.class))).thenReturn(new RecruitmentDTO());
        doNothing().when(recruitmentService).delete(eq(1L));
        doNothing().when(recruitmentService).updateStatus(eq(1L), eq("ACCEPTED"));
        doNothing().when(recruitmentService).updateStatus(eq(1L), eq("REFUSED"));

        mockMvc.perform(post("/api/recruitment")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new RecruitmentDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/recruitment"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/recruitment/1"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/recruitment/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new RecruitmentDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/recruitment/1"))
                .andExpect(status().isNoContent());
        mockMvc.perform(patch("/api/recruitment/1/accept"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/recruitment/1/refuse"))
                .andExpect(status().isOk());
    }
}




