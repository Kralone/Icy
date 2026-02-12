package com.icy.icy_backend.service.goal;

import com.icy.icy_backend.controller.dto.goal.CreateGoalDTO;
import com.icy.icy_backend.db.entity.goal.Goal;
import com.icy.icy_backend.db.entity.goal.GoalParticipation;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.goal.GoalParticipationRepository;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoalServiceTest {

    @Test
    void createGoalSavesAndBroadcasts() {
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository participationRepository = Mockito.mock(GoalParticipationRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        GoalService service = new GoalService(goalRepository, participationRepository, userRepository, notificationPushService);

        CreateGoalDTO dto = new CreateGoalDTO();
        dto.setName("Goal");
        dto.setTarget(10);

        service.createGoal(dto);
        verify(goalRepository).save(any(Goal.class));
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }

    @Test
    void updateGoalRejectsSelfParent() {
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository participationRepository = Mockito.mock(GoalParticipationRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        GoalService service = new GoalService(goalRepository, participationRepository, userRepository, notificationPushService);

        Goal goal = new Goal();
        goal.setId(1L);
        goal.setTarget(1);
        when(goalRepository.findById(1L)).thenReturn(Optional.of(goal));

        CreateGoalDTO dto = new CreateGoalDTO();
        dto.setParentId(1L);

        assertThatThrownBy(() -> service.updateGoal(1L, dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void incrementGoalStoresParticipationAndNotifiesCompletion() {
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository participationRepository = Mockito.mock(GoalParticipationRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        GoalService service = new GoalService(goalRepository, participationRepository, userRepository, notificationPushService);

        Goal goal = new Goal();
        goal.setId(1L);
        goal.setTarget(5);
        goal.setCurrent(4);
        when(goalRepository.findById(1L)).thenReturn(Optional.of(goal));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(participationRepository.findByGoal_IdAndUser_Id(1L, userId)).thenReturn(Optional.of(
                GoalParticipation.builder().goal(goal).user(user).delta(0).createdAt(LocalDateTime.now()).build()
        ));

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            service.incrementGoal(1L, 1);
        }

        verify(participationRepository).save(any(GoalParticipation.class));
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }
}
