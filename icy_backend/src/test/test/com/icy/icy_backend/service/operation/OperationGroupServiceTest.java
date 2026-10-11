package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OperationGroupServiceTest {
    @Test void rejectsParentFromAnotherOperation() {
        OperationRepository operations = mock(OperationRepository.class);
        OperationGroupRepository groups = mock(OperationGroupRepository.class);
        UUID id = UUID.randomUUID();
        when(operations.findById(id)).thenReturn(Optional.of(com.icy.icy_backend.db.entity.event.Operation.builder().eventId(id).build()));
        when(groups.findById(10L)).thenReturn(Optional.of(OperationGroup.builder().id(10L).operationEventId(UUID.randomUUID()).build()));
        var request = new com.icy.icy_backend.controller.dto.operation.OperationGroupRequest();
        request.setName("Enfant"); request.setParentId(10L);
        var service = new OperationGroupService(operations, groups, mock(MessageService.class), mock(OperationAssignmentRepository.class));
        assertThatThrownBy(() -> service.create(id, request)).isInstanceOf(IllegalArgumentException.class);
    }
    private final UUID operationId = UUID.randomUUID();
    private final OperationGroupRepository repository = mock(OperationGroupRepository.class);
    private final OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
    private final OperationRepository operations = mock(OperationRepository.class);
    private final OperationGroupService service = new OperationGroupService(operations, repository, mock(MessageService.class), assignments);

    private OperationGroup group(long id, Long parent) {
        OperationGroup group = OperationGroup.builder().id(id).operationEventId(operationId).parentId(parent).sortOrder(9).build();
        when(repository.findById(id)).thenReturn(Optional.of(group));
        return group;
    }

    @Test void rejectsPartialSiblingListBeforeWriting() {
        OperationGroup first = group(1, null), second = group(2, null);
        when(repository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(first, second));
        assertThatThrownBy(() -> service.reorder(operationId, List.of(1L))).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
        assertThat(first.getSortOrder()).isEqualTo(9);
    }

    @Test void rejectsMixedParentsBeforeWriting() {
        group(1, null); group(2, 3L);
        assertThatThrownBy(() -> service.reorder(operationId, List.of(1L, 2L))).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test void rejectsGroupsFromAnotherOperationBeforeWriting() {
        group(1, null).setOperationEventId(UUID.randomUUID());
        assertThatThrownBy(() -> service.reorder(operationId, List.of(1L))).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test void reordersCompleteSiblingListWithoutChangingOtherFamilies() {
        OperationGroup first = group(1, null), second = group(2, null), child = group(3, 1L);
        when(repository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(first, second, child));
        service.reorder(operationId, List.of(2L, 1L));
        assertThat(second.getSortOrder()).isZero();
        assertThat(first.getSortOrder()).isEqualTo(1);
        assertThat(child.getSortOrder()).isEqualTo(9);
        verify(repository, never()).save(child);
    }

    @Test void rejectsCapacityBelowConfirmedSubtreeUsers() {
        OperationGroup parent = OperationGroup.builder().id(1L).operationEventId(operationId).parentId(null).capacity(5).build();
        OperationGroup child = OperationGroup.builder().id(2L).operationEventId(operationId).parentId(1L).capacity(3).build();
        when(repository.findById(1L)).thenReturn(Optional.of(parent));
        when(repository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(parent, child));
        UUID user = UUID.randomUUID();
        when(assignments.findByOperationEventId(operationId)).thenReturn(List.of(OperationAssignment.builder().operationEventId(operationId).groupId(2L).userId(user).status(OperationAssignment.Status.CONFIRMED).build()));
        var request = new com.icy.icy_backend.controller.dto.operation.OperationGroupRequest();
        request.setName("Parent"); request.setCapacity(0); request.setAssignmentMode(OperationGroup.AssignmentMode.MANAGED);
        assertThatThrownBy(() -> service.update(operationId, 1L, request)).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }
}
