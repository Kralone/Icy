package com.icy.icy_backend.service.operation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationResponseDTO;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.service.common.MessageService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationServiceTest {

    @Test
    void convertsEventToPrivateDraftWithSameIdentity() {
        EventRepository events = Mockito.mock(EventRepository.class);
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        OperationService service = new OperationService(events, operations, messages, entityManager, new ObjectMapper());
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setActivityType(ActivityType.EVENT);
        when(events.findById(eventId)).thenReturn(Optional.of(event));
        when(operations.findById(eventId)).thenReturn(Optional.empty());
        ResponseEntity<MessageResponse<OperationResponseDTO>> response = ResponseEntity.ok().build();
        Mockito.doReturn(response).when(messages).buildResponse(eq("operation.draft.created"), any());

        ResponseEntity<MessageResponse<OperationResponseDTO>> actual = service.convert(eventId);

        assertThat(actual).isSameAs(response);
        assertThat(event.getActivityType()).isEqualTo(ActivityType.OPERATION);
        verify(events).save(event);
        verify(entityManager).flush();
        verify(entityManager).persist(Mockito.argThat(value -> value instanceof Operation operation
                && operation.getEventId().equals(eventId)
                && operation.getPublicationStatus() == Operation.PublicationStatus.DRAFT));
    }

    @Test
    void updatesPublishedOperationWithoutChangingItsIdentityOrPublicationStatus() {
        EventRepository events = Mockito.mock(EventRepository.class);
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        ObjectMapper objectMapper = new ObjectMapper();
        OperationService service = new OperationService(events, operations, messages, entityManager, objectMapper);

        UUID operationId = UUID.randomUUID();
        Event event = new Event();
        event.setId(operationId);
        event.setActivityType(ActivityType.OPERATION);
        Operation operation = Operation.builder()
                .eventId(operationId)
                .event(event)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED)
                .briefing("Briefing initial")
                .build();
        when(events.findById(operationId)).thenReturn(Optional.of(event));
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(operations.save(operation)).thenReturn(operation);
        ResponseEntity<MessageResponse<OperationResponseDTO>> response = ResponseEntity.ok().build();
        Mockito.doReturn(response).when(messages).buildResponse(eq("operation.updated"), any());

        OperationUpdateRequest request = new OperationUpdateRequest();
        request.setBriefing("Briefing mis à jour");
        request.setObjectives("[{\"kind\":\"PRINCIPAL\",\"text\":\"Objectif\"}]");
        request.setImageUrl("https://example.test/mission.webp");
        request.setAllowShipProposals(true);

        ResponseEntity<MessageResponse<OperationResponseDTO>> actual = service.update(operationId, request);

        assertThat(actual).isSameAs(response);
        assertThat(operation.getEventId()).isEqualTo(operationId);
        assertThat(operation.getPublicationStatus()).isEqualTo(Operation.PublicationStatus.PUBLISHED);
        assertThat(operation.getBriefing()).isEqualTo("Briefing mis à jour");
        assertThat(operation.getImageUrl()).isEqualTo("https://example.test/mission.webp");
        assertThat(operation.isAllowShipProposals()).isTrue();
        verify(operations).save(operation);
    }

    @Test
    void rejectsMalformedObjectivesAndNonHttpImageUrls() {
        EventRepository events = Mockito.mock(EventRepository.class);
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        OperationService service = new OperationService(events, operations, messages, entityManager, new ObjectMapper());
        UUID operationId = UUID.randomUUID();
        Event event = new Event();
        event.setId(operationId);
        event.setActivityType(ActivityType.OPERATION);
        Operation operation = Operation.builder().eventId(operationId).event(event).build();
        when(events.findById(operationId)).thenReturn(Optional.of(event));
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));

        OperationUpdateRequest malformedObjectives = new OperationUpdateRequest();
        malformedObjectives.setObjectives("[{\"kind\":\"UNKNOWN\",\"text\":\"x\"}]");
        assertThatThrownBy(() -> service.update(operationId, malformedObjectives))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Objectif invalide");

        OperationUpdateRequest invalidImage = new OperationUpdateRequest();
        invalidImage.setImageUrl("javascript:alert(1)");
        assertThatThrownBy(() -> service.update(operationId, invalidImage))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URL d’image invalide");
        Mockito.verify(operations, Mockito.never()).save(operation);
    }
}
