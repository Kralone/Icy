package com.icy.icy_backend.service.event;

import com.icy.icy_backend.controller.dto.event.EventTypeRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.EventTypeResponseDTO;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.EventTypeRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceInUseException;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.websocket.EventWebSocketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Types d'événement : suppression refusée tant qu'ils sont utilisés, archivage, renommage et validation. */
class EventTypeManagementTest {

    private final EventRepository eventRepository = Mockito.mock(EventRepository.class);
    private final EventTypeRepository typeRepository = Mockito.mock(EventTypeRepository.class);
    private final MessageService messageService = Mockito.mock(MessageService.class);
    private final EventService service = new EventService(
            eventRepository, messageService, Mockito.mock(EventWebSocketService.class),
            typeRepository, Mockito.mock(EventParticipationRepository.class), Mockito.mock(UserService.class),
            Mockito.mock(AuthService.class), Mockito.mock(EventPublisher.class), Mockito.mock(NotificationPushService.class));

    @BeforeEach
    void echoResponses() {
        when(messageService.buildResponse(anyString(), any(), any(Object[].class))).thenAnswer(call ->
                ResponseEntity.ok(new MessageResponse<>(HttpStatus.OK, "t", "m", 0, call.getArgument(1))));
        when(messageService.buildResponse(anyString(), any())).thenAnswer(call ->
                ResponseEntity.ok(new MessageResponse<>(HttpStatus.OK, "t", "m", 0, call.getArgument(1))));
        when(typeRepository.save(any(EventType.class))).thenAnswer(call -> call.getArgument(0));
        when(typeRepository.saveAndFlush(any(EventType.class))).thenAnswer(call -> call.getArgument(0));
    }

    private static EventType type(String name) {
        EventType type = new EventType();
        type.setName(name);
        return type;
    }

    private static EventTypeRequest request(String name, String text, String background, String image) {
        EventTypeRequest request = new EventTypeRequest();
        request.setName(name);
        request.setTextColor(text);
        request.setBackgroundColor(background);
        request.setImageUrl(image);
        return request;
    }

    @Test
    void deletesAnUnusedType() {
        when(typeRepository.existsById("Minage")).thenReturn(true);
        when(eventRepository.countByType_Name("Minage")).thenReturn(0L);

        service.deleteEventType("Minage");

        verify(typeRepository).deleteById("Minage");
    }

    @Test
    void refusesToDeleteATypeStillUsedAndSuggestsArchiving() {
        when(typeRepository.existsById("Combat")).thenReturn(true);
        when(eventRepository.countByType_Name("Combat")).thenReturn(3L);

        assertThatThrownBy(() -> service.deleteEventType("Combat"))
                .isInstanceOf(ResourceInUseException.class)
                .hasMessageContaining("3 activités")
                .hasMessageContaining("Archivez");
        verify(typeRepository, never()).deleteById(any());
    }

    @Test
    void archivesAndRestoresAType() {
        EventType combat = type("Combat");
        when(typeRepository.findById("Combat")).thenReturn(Optional.of(combat));
        when(eventRepository.countByType_Name("Combat")).thenReturn(2L);

        EventTypeResponseDTO archived = service.setEventTypeArchived("Combat", true).getBody().getData();
        assertThat(archived.isArchived()).isTrue();
        assertThat(archived.getUsageCount()).isEqualTo(2);

        assertThat(service.setEventTypeArchived("Combat", false).getBody().getData().isArchived()).isFalse();
    }

    @Test
    void listsActiveTypesFirstWithTheirUsage() {
        EventType old = type("Ancien");
        old.setArchived(true);
        when(typeRepository.findAll()).thenReturn(List.of(old, type("minage"), type("Combat")));
        when(eventRepository.countByTypeName()).thenReturn(List.<Object[]>of(new Object[]{"Combat", 4L}, new Object[]{"Ancien", 1L}));

        List<EventTypeResponseDTO> types = service.getAllEventsTypes().getBody().getData();

        assertThat(types).extracting(EventTypeResponseDTO::getName).containsExactly("Combat", "minage", "Ancien");
        assertThat(types).extracting(EventTypeResponseDTO::getUsageCount).containsExactly(4L, 0L, 1L);
    }

    @Test
    void createsATypeWithNormalizedValues() {
        when(typeRepository.findAll()).thenReturn(List.of());

        EventTypeResponseDTO created = service.createEventType(request("  Exploration ", "#AEEEFF", "#123047", "  ")).getBody().getData();

        assertThat(created.getName()).isEqualTo("Exploration");
        assertThat(created.getTextColor()).isEqualTo("#aeeeff");
        assertThat(created.getImageUrl()).isNull();
    }

    @Test
    void refusesDuplicateNamesIgnoringCase() {
        when(typeRepository.findAll()).thenReturn(List.of(type("Combat")));

        assertThatThrownBy(() -> service.createEventType(request("combat", "#ffffff", "#000000", null)))
                .isInstanceOf(ResourceAlreadyExistsException.class);
    }

    @Test
    void refusesInvalidColorsAndNames() {
        assertThatThrownBy(() -> service.createEventType(request("Combat", "black", "#000000", null)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("#RRGGBB");
        assertThatThrownBy(() -> service.createEventType(request(" ", "#ffffff", "#000000", null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.createEventType(request("A/B", "#ffffff", "#000000", null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void renamingMovesActivitiesBeforeRemovingTheOldName() {
        EventType combat = type("Combat");
        when(typeRepository.findById("Combat")).thenReturn(Optional.of(combat));
        when(typeRepository.findAll()).thenReturn(List.of(combat));
        when(eventRepository.reassignType(eq(combat), any(EventType.class))).thenReturn(5);

        EventTypeResponseDTO renamed = service.updateEventType("Combat", request("Combat spatial", "#ffffff", "#7a1f2b", null)).getBody().getData();

        assertThat(renamed.getName()).isEqualTo("Combat spatial");
        assertThat(renamed.getUsageCount()).isEqualTo(5);
        ArgumentCaptor<EventType> created = ArgumentCaptor.forClass(EventType.class);
        var order = inOrder(typeRepository, eventRepository);
        order.verify(typeRepository).saveAndFlush(created.capture());
        order.verify(eventRepository).reassignType(eq(combat), any(EventType.class));
        order.verify(typeRepository).delete(combat);
        assertThat(created.getValue().getBackgroundColor()).isEqualTo("#7a1f2b");
    }

    @Test
    void renamingToAnExistingTypeIsRefused() {
        EventType combat = type("Combat");
        when(typeRepository.findById("Combat")).thenReturn(Optional.of(combat));
        when(typeRepository.findByName("Minage")).thenReturn(type("Minage"));

        assertThatThrownBy(() -> service.updateEventType("Combat", request("Minage", "#ffffff", "#000000", null)))
                .isInstanceOf(ResourceAlreadyExistsException.class);
        verify(eventRepository, never()).reassignType(any(), any());
    }
}
