package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class OperationShipServiceTest {
    @Test
    void rejectsShipOutsidePersonalHangar() {
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        UserShipRepository hangar = Mockito.mock(UserShipRepository.class);
        OperationShipProposalRepository proposals = Mockito.mock(OperationShipProposalRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        OperationGroupRepository groups = Mockito.mock(OperationGroupRepository.class);
        Operation operation = Operation.builder().eventId(UUID.randomUUID()).publicationStatus(Operation.PublicationStatus.PUBLISHED).build();
        when(operations.findById(operation.getEventId())).thenReturn(Optional.of(operation));
        when(hangar.existsByUserIdAndShipId(any(), any())).thenReturn(false);
        OperationShipService service = new OperationShipService(operations, hangar, proposals, messages, groups);
        try (MockedStatic<AuthUtils> auth = Mockito.mockStatic(AuthUtils.class)) {
            auth.when(AuthUtils::getCurrentUserId).thenReturn(UUID.randomUUID());
            assertThatThrownBy(() -> service.propose(operation.getEventId(), 42L, null)).isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
