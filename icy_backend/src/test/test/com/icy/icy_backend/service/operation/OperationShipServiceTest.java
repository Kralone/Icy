package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
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
        EventParticipationRepository participations = Mockito.mock(EventParticipationRepository.class);
        OperationShipRequirementRepository requirements = Mockito.mock(OperationShipRequirementRepository.class);
        when(participations.existsByEvent_IdAndUser_IdAndStatus(any(), any(), Mockito.eq(1))).thenReturn(true);
        Operation operation = Operation.builder().eventId(UUID.randomUUID()).publicationStatus(Operation.PublicationStatus.PUBLISHED).allowShipProposals(true).build();
        when(operations.findById(operation.getEventId())).thenReturn(Optional.of(operation));
        when(hangar.existsByUserIdAndShipId(any(), any())).thenReturn(false);
        OperationShipService service = new OperationShipService(operations, hangar, proposals, messages, groups, participations, requirements);
        try (MockedStatic<AuthUtils> auth = Mockito.mockStatic(AuthUtils.class)) {
            auth.when(AuthUtils::getCurrentUserId).thenReturn(UUID.randomUUID());
            assertThatThrownBy(() -> service.propose(operation.getEventId(), 42L, null, null)).isInstanceOf(ResourceNotFoundException.class);
            Mockito.verify(hangar).existsByUserIdAndShipId(any(), Mockito.eq(42L));
            Mockito.verifyNoInteractions(proposals);
        }
    }

    @Test
    void associatesProposalWithNonCancelledRequirementAndUsesItsGroup() {
        OperationRepository operations = Mockito.mock(OperationRepository.class);
        UserShipRepository hangar = Mockito.mock(UserShipRepository.class);
        OperationShipProposalRepository proposals = Mockito.mock(OperationShipProposalRepository.class);
        MessageService messages = Mockito.mock(MessageService.class);
        OperationGroupRepository groups = Mockito.mock(OperationGroupRepository.class);
        EventParticipationRepository participations = Mockito.mock(EventParticipationRepository.class);
        OperationShipRequirementRepository requirements = Mockito.mock(OperationShipRequirementRepository.class);
        UUID operationId = UUID.randomUUID();
        UUID requirementId = UUID.randomUUID();
        UUID owner = UUID.randomUUID();
        Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).allowShipProposals(true).build();
        OperationShipRequirement requirement = OperationShipRequirement.builder().id(requirementId).operationEventId(operationId).groupId(4L).status(OperationShipRequirement.Status.OPEN).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(participations.existsByEvent_IdAndUser_IdAndStatus(operationId, owner, 1)).thenReturn(true);
        when(hangar.existsByUserIdAndShipId(owner, 42L)).thenReturn(true);
        when(requirements.findById(requirementId)).thenReturn(Optional.of(requirement));
        try (MockedStatic<AuthUtils> auth = Mockito.mockStatic(AuthUtils.class)) {
            auth.when(AuthUtils::getCurrentUserId).thenReturn(owner);
            OperationShipService service = new OperationShipService(operations, hangar, proposals, messages, groups, participations, requirements);
            service.propose(operationId, 42L, null, requirementId);
            org.mockito.Mockito.verify(proposals).save(org.mockito.ArgumentMatchers.argThat(value -> requirementId.equals(value.getRequirementId()) && Long.valueOf(4L).equals(value.getGroupId())));
        }
    }
}
