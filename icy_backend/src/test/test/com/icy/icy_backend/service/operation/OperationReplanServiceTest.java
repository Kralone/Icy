package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationReplanServiceTest {
    private final OperationGroupRepository groups = Mockito.mock(OperationGroupRepository.class);
    private final OperationGroupPositionRepository positions = Mockito.mock(OperationGroupPositionRepository.class);
    private final OperationShipRequirementRepository requirements = Mockito.mock(OperationShipRequirementRepository.class);
    private final OperationReplanService service = new OperationReplanService(groups, positions, requirements);
    private final UUID sourceId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();

    @Test
    void copiesGroupsCrewsPositionsAndOpenRequirementsOntoTheNewOperation() {
        UUID presetId = UUID.randomUUID();
        UUID responsibleId = UUID.randomUUID();
        // Le sous-groupe est lu avant son parent : la copie doit quand même le rattacher au parent copié.
        OperationGroup child = OperationGroup.builder().id(2L).operationEventId(sourceId).parentId(1L).name("Escorte").sortOrder(0)
                .kind(OperationGroup.Kind.CREW).shipModelId(42L).shipModelName("Gladius").positionMode(OperationGroup.PositionMode.MANAGED)
                .crewPresetId(presetId).capacity(1).build();
        OperationGroup root = OperationGroup.builder().id(1L).operationEventId(sourceId).name("Aile").sortOrder(1)
                .assignmentMode(OperationGroup.AssignmentMode.VALIDATION).responsibleUserId(responsibleId).build();
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(sourceId)).thenReturn(List.of(child, root));
        AtomicLong ids = new AtomicLong(100);
        when(groups.save(any())).thenAnswer(invocation -> {
            OperationGroup group = invocation.getArgument(0);
            group.setId(ids.incrementAndGet());
            return group;
        });
        when(positions.findByGroupIdInOrderBySortOrderAscIdAsc(Set.of(1L, 2L))).thenReturn(List.of(
                OperationGroupPosition.builder().id(9L).groupId(2L).label("Pilote").icon("pilot").capacity(1).sortOrder(0).build()));
        when(requirements.findByOperationEventIdOrderByCreatedAtAsc(sourceId)).thenReturn(List.of(
                OperationShipRequirement.builder().operationEventId(sourceId).groupId(2L).shipModelId(42L).quantity(2).notes("Escorte")
                        .status(OperationShipRequirement.Status.FULFILLED).build(),
                OperationShipRequirement.builder().operationEventId(sourceId).shipModelId(7L).status(OperationShipRequirement.Status.CANCELLED).build()));

        service.copyOrganization(sourceId, targetId);

        ArgumentCaptor<OperationGroup> savedGroups = ArgumentCaptor.forClass(OperationGroup.class);
        verify(groups, times(2)).save(savedGroups.capture());
        OperationGroup rootCopy = savedGroups.getAllValues().get(0);
        OperationGroup childCopy = savedGroups.getAllValues().get(1);
        assertThat(rootCopy.getOperationEventId()).isEqualTo(targetId);
        assertThat(rootCopy.getParentId()).isNull();
        assertThat(rootCopy.getAssignmentMode()).isEqualTo(OperationGroup.AssignmentMode.VALIDATION);
        assertThat(rootCopy.getResponsibleUserId()).isEqualTo(responsibleId);
        assertThat(childCopy.getParentId()).isEqualTo(rootCopy.getId());
        assertThat(childCopy.getKind()).isEqualTo(OperationGroup.Kind.CREW);
        assertThat(childCopy.getShipModelName()).isEqualTo("Gladius");
        assertThat(childCopy.getCrewPresetId()).isEqualTo(presetId);

        ArgumentCaptor<OperationGroupPosition> savedPosition = ArgumentCaptor.forClass(OperationGroupPosition.class);
        verify(positions).save(savedPosition.capture());
        assertThat(savedPosition.getValue().getId()).isNull();
        assertThat(savedPosition.getValue().getGroupId()).isEqualTo(childCopy.getId());
        assertThat(savedPosition.getValue().getLabel()).isEqualTo("Pilote");

        ArgumentCaptor<OperationShipRequirement> savedRequirement = ArgumentCaptor.forClass(OperationShipRequirement.class);
        verify(requirements).save(savedRequirement.capture());
        assertThat(savedRequirement.getValue().getOperationEventId()).isEqualTo(targetId);
        assertThat(savedRequirement.getValue().getGroupId()).isEqualTo(childCopy.getId());
        assertThat(savedRequirement.getValue().getQuantity()).isEqualTo(2);
        assertThat(savedRequirement.getValue().getStatus()).isEqualTo(OperationShipRequirement.Status.OPEN);
    }

    @Test
    void anOperationWithoutOrganizationGivesAnEmptyDraft() {
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(sourceId)).thenReturn(List.of());
        when(requirements.findByOperationEventIdOrderByCreatedAtAsc(sourceId)).thenReturn(List.of());

        service.copyOrganization(sourceId, targetId);

        verify(groups, Mockito.never()).save(any());
        verify(positions, Mockito.never()).findByGroupIdInOrderBySortOrderAscIdAsc(any());
        verify(requirements, Mockito.never()).save(any());
    }
}
