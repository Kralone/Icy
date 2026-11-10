package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.user.UserTutorialDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserTutorialRequest;
import com.icy.icy_backend.db.entity.user.UserTutorial;
import com.icy.icy_backend.db.entity.user.UserTutorialStatus;
import com.icy.icy_backend.db.entity.user.id.UserTutorialId;
import com.icy.icy_backend.db.repository.user.UserTutorialRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserTutorialServiceTest {
    private final UUID userId = UUID.randomUUID();
    private UserTutorialRepository repository;
    private MessageService messageService;
    private UserTutorialService service;

    @BeforeEach
    void setUp() {
        repository = Mockito.mock(UserTutorialRepository.class);
        messageService = Mockito.mock(MessageService.class);
        service = new UserTutorialService(repository, messageService);
        when(repository.save(any(UserTutorial.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void getTutorialsListsOnlyTheCurrentUser() {
        UserTutorial seen = new UserTutorial(userId, "operation-page", 2, UserTutorialStatus.COMPLETED, LocalDateTime.now());
        when(repository.findByUserIdOrderByTutorialIdAsc(userId)).thenReturn(List.of(seen));

        service.getTutorials(userId);

        verify(messageService).buildResponse(eq("user.tutorial.list"), eq(List.of(UserTutorialDTO.from(seen))));
    }

    @Test
    void saveTutorialCreatesTheFirstRecord() {
        when(repository.findById(new UserTutorialId(userId, "hangar"))).thenReturn(Optional.empty());

        service.saveTutorial(userId, "hangar", request(1, "DISMISSED"));

        ArgumentCaptor<UserTutorial> saved = ArgumentCaptor.forClass(UserTutorial.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(userId);
        assertThat(saved.getValue().getTutorialId()).isEqualTo("hangar");
        assertThat(saved.getValue().getVersion()).isEqualTo(1);
        assertThat(saved.getValue().getStatus()).isEqualTo(UserTutorialStatus.DISMISSED);
        assertThat(saved.getValue().getUpdatedAt()).isNotNull();
        verify(messageService).buildResponse(eq("user.tutorial.saved"), any(UserTutorialDTO.class));
    }

    @Test
    void saveTutorialUpdatesTheExistingRecordToTheNewVersion() {
        UserTutorial existing = new UserTutorial(userId, "scwe", 1, UserTutorialStatus.DISMISSED, LocalDateTime.now().minusDays(3));
        when(repository.findById(new UserTutorialId(userId, "scwe"))).thenReturn(Optional.of(existing));

        service.saveTutorial(userId, "scwe", request(2, "COMPLETED"));

        assertThat(existing.getVersion()).isEqualTo(2);
        assertThat(existing.getStatus()).isEqualTo(UserTutorialStatus.COMPLETED);
        verify(repository).save(existing);
    }

    @Test
    void saveTutorialRejectsInvalidInputWithoutWriting() {
        service.saveTutorial(userId, "../admin", request(1, "COMPLETED"));
        service.saveTutorial(userId, "x".repeat(65), request(1, "COMPLETED"));
        service.saveTutorial(userId, "hangar", request(0, "COMPLETED"));
        service.saveTutorial(userId, "hangar", request(1, "STARTED"));
        service.saveTutorial(userId, "hangar", null);

        verify(repository, never()).save(any());
        verify(messageService, Mockito.times(5)).buildResponse(eq("user.tutorial.invalid"), eq(null), any(Object[].class));
    }

    private static UpdateUserTutorialRequest request(Integer version, String status) {
        UpdateUserTutorialRequest request = new UpdateUserTutorialRequest();
        request.setVersion(version);
        request.setStatus(status);
        return request;
    }
}
