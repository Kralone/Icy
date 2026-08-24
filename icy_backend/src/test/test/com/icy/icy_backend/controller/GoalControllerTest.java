package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.goal.GoalController;
import com.icy.icy_backend.controller.dto.goal.CreateGoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationSummaryDTO;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.goal.GoalService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
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

@WebMvcTest(controllers = GoalController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class GoalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GoalService goalService;

    @Test
    void goalEndpointsReturnOk() throws Exception {
        doNothing().when(goalService).createGoal(any(CreateGoalDTO.class));
        doNothing().when(goalService).updateGoal(eq(1L), any(CreateGoalDTO.class));
        when(goalService.getAllTopLevelGoals()).thenReturn(List.of(new GoalDTO()));
        when(goalService.getPinnedGoal()).thenReturn(new GoalDTO());
        doNothing().when(goalService).deleteGoal(eq(1L));
        doNothing().when(goalService).pinGoal(eq(1L));
        doNothing().when(goalService).incrementGoal(eq(1L), eq(1));
        when(goalService.getParticipations(eq(1L), eq(10))).thenReturn(List.of(
                GoalParticipationDTO.builder()
                        .id(UUID.randomUUID())
                        .goalId(1L)
                        .userId(UUID.randomUUID())
                        .username("user")
                        .avatarUrl("avatar")
                        .delta(1)
                        .totalAfter(1)
                        .createdAt(LocalDateTime.now())
                        .build()
        ));
        when(goalService.getCombinedParticipations(eq(1L), eq(10)))
                .thenReturn(List.of(
                        GoalParticipationSummaryDTO.builder()
                                .userId(UUID.randomUUID())
                                .username("user")
                                .avatarUrl("avatar")
                                .totalDelta(1)
                                .percentOfCurrent(0.5)
                                .build()
                ));

        CreateGoalDTO dto = new CreateGoalDTO();
        dto.setName("name");

        mockMvc.perform(post("/api/goals")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/goals/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/goals"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/goals/pinned"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/goals/1"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/goals/1/pin"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/goals/pin")
                        .contentType("application/json")
                        .content("1"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/goals/1/increment")
                        .param("delta", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/goals/1/participations"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/goals/1/participations/combined"))
                .andExpect(status().isOk());
    }
}




