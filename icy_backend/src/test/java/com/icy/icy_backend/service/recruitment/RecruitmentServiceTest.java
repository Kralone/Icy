package com.icy.icy_backend.service.recruitment;

import com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO;
import com.icy.icy_backend.db.entity.recruitment.Recruitment;
import com.icy.icy_backend.db.repository.recruitment.RecruitmentRepository;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecruitmentServiceTest {

    @Test
    void createNotifiesAdmins() {
        RecruitmentRepository recruitmentRepository = Mockito.mock(RecruitmentRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        RecruitmentService service = new RecruitmentService(recruitmentRepository, userService, notificationPushService);

        RecruitmentDTO dto = new RecruitmentDTO();
        dto.setUsername("alice");

        when(recruitmentRepository.save(any(Recruitment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userService.getAdminUserIds()).thenReturn(List.of(java.util.UUID.randomUUID()));

        RecruitmentDTO result = service.create(dto);
        assertThat(result.getUsername()).isEqualTo("alice");
        verify(notificationPushService).sendToUsers(any(), any(), any(), any(), any());
    }

    @Test
    void updateStatusPersists() {
        RecruitmentRepository recruitmentRepository = Mockito.mock(RecruitmentRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        RecruitmentService service = new RecruitmentService(recruitmentRepository, userService, notificationPushService);

        Recruitment recruitment = new Recruitment();
        recruitment.setId(1L);
        when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(recruitment));

        service.updateStatus(1L, "APPROVED");
        verify(recruitmentRepository).save(recruitment);
        assertThat(recruitment.getStatus()).isEqualTo("APPROVED");
    }
}
