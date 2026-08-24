package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.goal.GoalTemplateController;
import com.icy.icy_backend.controller.dto.goal.ApplyGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.CreateGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.GoalTemplateTreeDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalTemplateDTO;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.goal.GoalTemplateService;
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

@WebMvcTest(controllers = GoalTemplateController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class GoalTemplateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GoalTemplateService goalTemplateService;

    @Test
    void goalTemplateEndpointsReturnOk() throws Exception {
        when(goalTemplateService.getAllTopLevelTemplates()).thenReturn(List.of(new GoalTemplateDTO()));
        doNothing().when(goalTemplateService).createTemplate(any(CreateGoalTemplateDTO.class));
        doNothing().when(goalTemplateService).createTemplateTree(any(GoalTemplateTreeDTO.class));
        doNothing().when(goalTemplateService).updateTemplate(eq(1L), any(CreateGoalTemplateDTO.class));
        doNothing().when(goalTemplateService).deleteTemplate(eq(1L));
        doNothing().when(goalTemplateService).applyTemplate(eq(1L), any(ApplyGoalTemplateDTO.class));

        mockMvc.perform(get("/api/goal-templates"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/goal-templates")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateGoalTemplateDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/goal-templates/batch")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new GoalTemplateTreeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/goal-templates/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateGoalTemplateDTO())))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/goal-templates/1"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/goal-templates/1/apply")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ApplyGoalTemplateDTO())))
                .andExpect(status().isOk());
    }
}




