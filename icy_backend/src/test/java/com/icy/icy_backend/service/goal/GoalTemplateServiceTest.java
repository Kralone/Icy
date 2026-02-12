package com.icy.icy_backend.service.goal;

import com.icy.icy_backend.controller.dto.goal.ApplyGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.CreateGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.GoalTemplateTreeDTO;
import com.icy.icy_backend.db.entity.goal.GoalTemplate;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.goal.GoalTemplateRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoalTemplateServiceTest {

    @Test
    void createTemplateTreeRejectsNull() {
        GoalTemplateRepository templateRepository = Mockito.mock(GoalTemplateRepository.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        GoalTemplateService service = new GoalTemplateService(templateRepository, goalRepository, userRepository);

        assertThatThrownBy(() -> service.createTemplateTree(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createTemplateStoresTemplate() {
        GoalTemplateRepository templateRepository = Mockito.mock(GoalTemplateRepository.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        GoalTemplateService service = new GoalTemplateService(templateRepository, goalRepository, userRepository);

        CreateGoalTemplateDTO dto = new CreateGoalTemplateDTO();
        dto.setName("Template");
        dto.setTarget(2);
        service.createTemplate(dto);

        verify(templateRepository).save(any(GoalTemplate.class));
    }

    @Test
    void applyTemplateResolvesUserAndParent() {
        GoalTemplateRepository templateRepository = Mockito.mock(GoalTemplateRepository.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        GoalTemplateService service = new GoalTemplateService(templateRepository, goalRepository, userRepository);

        GoalTemplate template = new GoalTemplate();
        template.setId(1L);
        when(templateRepository.findById(1L)).thenReturn(Optional.of(template));
        when(templateRepository.findByParent(template)).thenReturn(java.util.List.of());

        User user = new User();
        user.setId(UUID.randomUUID());
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        ApplyGoalTemplateDTO dto = new ApplyGoalTemplateDTO();
        dto.setUserId(user.getId());

        service.applyTemplate(1L, dto);
        verify(goalRepository).save(any());
    }
}
