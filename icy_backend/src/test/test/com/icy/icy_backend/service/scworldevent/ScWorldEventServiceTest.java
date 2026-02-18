package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventDTO;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventRepository;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScWorldEventServiceTest {

    @Test
    void createValidatesRequiredFields() {
        ScWorldEventRepository repository = Mockito.mock(ScWorldEventRepository.class);
        ScWorldEventTypeService typeService = Mockito.mock(ScWorldEventTypeService.class);
        ObjectMapper objectMapper = new ObjectMapper();
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        ScWorldEventService service = new ScWorldEventService(repository, typeService, objectMapper, notificationPushService);

        CreateScWorldEventDTO dto = new CreateScWorldEventDTO();
        assertThatThrownBy(() -> service.create(dto)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createSavesAndBroadcasts() {
        ScWorldEventRepository repository = Mockito.mock(ScWorldEventRepository.class);
        ScWorldEventTypeService typeService = Mockito.mock(ScWorldEventTypeService.class);
        ObjectMapper objectMapper = new ObjectMapper();
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        ScWorldEventService service = new ScWorldEventService(repository, typeService, objectMapper, notificationPushService);

        ScWorldEventType type = new ScWorldEventType();
        type.setName("Type");
        when(typeService.getByNameOrThrow("Type")).thenReturn(type);
        when(repository.save(any(ScWorldEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreateScWorldEventDTO dto = new CreateScWorldEventDTO();
        dto.setTitle("Event");
        dto.setTypeName("Type");
        dto.setStartAt(Instant.now());
        dto.setGallery("[]");

        ScWorldEvent saved = service.create(dto);
        assertThat(saved.getTitle()).isEqualTo("Event");
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }
}
