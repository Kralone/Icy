package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class OperationShipRequirementServiceTest {
    @Test
    void hidesDraftRequirementsFromParticipants() {
        UUID operationId = UUID.randomUUID();
        OperationRepository operations = mock(OperationRepository.class);
        OperationShipRequirementRepository requirements = mock(OperationShipRequirementRepository.class);
        Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.DRAFT).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        var service = new OperationShipRequirementService(operations, mock(OperationGroupRepository.class), requirements, mock(MessageService.class));

        try (MockedStatic<AuthUtils> auth = mockStatic(AuthUtils.class)) {
            auth.when(AuthUtils::isAdmin).thenReturn(false);
            auth.when(() -> AuthUtils.hasRole("OFFICIER")).thenReturn(false);
            assertThatThrownBy(() -> service.list(operationId)).isInstanceOf(ResourceNotFoundException.class);
            verifyNoInteractions(requirements);
        }
    }

    @Test
    void organizersCanReadDraftRequirementsForEditing() {
        UUID operationId = UUID.randomUUID();
        OperationRepository operations = mock(OperationRepository.class);
        OperationShipRequirementRepository requirements = mock(OperationShipRequirementRepository.class);
        Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.DRAFT).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(requirements.findByOperationEventIdOrderByCreatedAtAsc(operationId)).thenReturn(java.util.List.of());
        var service = new OperationShipRequirementService(operations, mock(OperationGroupRepository.class), requirements, mock(MessageService.class));

        try (MockedStatic<AuthUtils> auth = mockStatic(AuthUtils.class)) {
            auth.when(AuthUtils::isAdmin).thenReturn(true);
            assertThat(service.list(operationId)).isEmpty();
            verify(requirements).findByOperationEventIdOrderByCreatedAtAsc(operationId);
        }
    }
}
