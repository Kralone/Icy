package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.goal.GoalTemplateController;
import com.icy.icy_backend.controller.dto.goal.ApplyGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.CreateGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.GoalTemplateTreeDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalTemplateDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.goal.GoalTemplateService;
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

@WebMvcTest(controllers = GoalTemplateController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class GoalTemplateControllerTest {

    private static final UUID ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000012");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GoalTemplateService goalTemplateService;

    @MockitoBean
    private MessageService messageService;

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
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateGoalTemplateDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/goal-templates/batch")
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new GoalTemplateTreeDTO())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/goal-templates/1")
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new CreateGoalTemplateDTO())))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/goal-templates/1").with(TestAuth.user(ACTOR_ID, "OFFICIER")))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/goal-templates/1/apply")
                        .with(TestAuth.user(ACTOR_ID, "OFFICIER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ApplyGoalTemplateDTO())))
                .andExpect(status().isOk());
    }

    @Test
    void templateMutationsRejectRegularUsers() throws Exception {
        String create = objectMapper.writeValueAsString(new CreateGoalTemplateDTO());
        String batch = objectMapper.writeValueAsString(new GoalTemplateTreeDTO());
        String apply = objectMapper.writeValueAsString(new ApplyGoalTemplateDTO());

        mockMvc.perform(post("/api/goal-templates").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(create))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/goal-templates/batch").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(batch))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/goal-templates/1").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(create))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/goal-templates/1").with(TestAuth.user(ACTOR_ID, "USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/goal-templates/1/apply").with(TestAuth.user(ACTOR_ID, "USER"))
                        .contentType("application/json").content(apply))
                .andExpect(status().isForbidden());
    }
}




