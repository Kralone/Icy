package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

class OperationGroupServiceTest {
    @Test
    void rejectsParentFromAnotherOperation() {
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        OperationGroupRepository groups = Mockito.mock(OperationGroupRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        UUID operationId = UUID.randomUUID();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId).build()));
        Long parentId = 10L;
        when(groups.findById(parentId)).thenReturn(Optional.of(OperationGroup.builder().id(parentId).operationEventId(UUID.randomUUID()).name("Autre").build()));
        OperationGroupRequest request = new OperationGroupRequest();
        request.setName("Enfant"); request.setParentId(parentId);
        OperationGroupService service = new OperationGroupService(operations, groups, messages);
        assertThatThrownBy(() -> service.create(operationId, request)).isInstanceOf(IllegalArgumentException.class);
    }
}
