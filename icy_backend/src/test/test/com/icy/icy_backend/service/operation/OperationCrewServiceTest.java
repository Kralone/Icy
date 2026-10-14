package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.operation.OperationPositionRequest;
import com.icy.icy_backend.controller.dto.response.event.OperationCrewDTO;
import com.icy.icy_backend.controller.operation.OperationCrewPresetController;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationCrewPreset;
import com.icy.icy_backend.db.entity.event.OperationCrewPresetPosition;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationCrewPresetPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationCrewPresetRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.OperationClosedException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Lot E1 : équipages de vaisseau, postes facultatifs et attribution des postes. */
class OperationCrewServiceTest {
    private final UUID operationId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID otherId = UUID.randomUUID();
    private final UUID responsibleId = UUID.randomUUID();

    private final OperationRepository operations = mock(OperationRepository.class);
    private final OperationGroupRepository groups = mock(OperationGroupRepository.class);
    private final OperationGroupPositionRepository positions = mock(OperationGroupPositionRepository.class);
    private final OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
    private final OperationCrewPresetRepository presets = mock(OperationCrewPresetRepository.class);
    private final OperationCrewPresetPositionRepository presetPositions = mock(OperationCrewPresetPositionRepository.class);
    private final EventParticipationRepository participation = mock(EventParticipationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ShipRepository ships = mock(ShipRepository.class);
    private final OperationAssignmentService assignmentService = mock(OperationAssignmentService.class);
    private final OperationLock lock = mock(OperationLock.class);

    private final Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).build();
    private final OperationGroup polaris = OperationGroup.builder().id(2L).operationEventId(operationId).name("Équipage Polaris")
            .kind(OperationGroup.Kind.CREW).shipModelId(70L).shipModelName("Polaris").build();
    private final OperationGroup mole = OperationGroup.builder().id(3L).operationEventId(operationId).name("Équipage MOLE")
            .kind(OperationGroup.Kind.CREW).shipModelId(71L).shipModelName("MOLE").build();
    private final OperationGroup escorte = OperationGroup.builder().id(4L).operationEventId(operationId).name("Escorte").build();
    private final OperationGroupPosition pilot = OperationGroupPosition.builder().id(10L).groupId(2L).label("Pilote").capacity(1).build();
    private final OperationGroupPosition gunner = OperationGroupPosition.builder().id(11L).groupId(2L).label("Artilleur").build();
    private final OperationGroupPosition miner = OperationGroupPosition.builder().id(20L).groupId(3L).label("Mineur").build();
    private final OperationAssignment mine = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(2L).userId(memberId).build();

    private final OperationCrewService service = new OperationCrewService(operations, groups, positions, assignments, presets, presetPositions,
            participation, users, ships, assignmentService, lock, mock(MessageService.class), new CrewPresetApplier(groups, positions));

    OperationCrewServiceTest() {
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        for (OperationGroup group : List.of(polaris, mole, escorte)) {
            when(groups.findById(group.getId())).thenReturn(Optional.of(group));
            when(groups.findLockedById(group.getId())).thenReturn(Optional.of(group));
        }
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(polaris, mole, escorte));
        for (OperationGroupPosition position : List.of(pilot, gunner, miner)) when(positions.findById(position.getId())).thenReturn(Optional.of(position));
        when(positions.findByGroupIdOrderBySortOrderAscIdAsc(2L)).thenReturn(List.of(pilot, gunner));
        when(positions.save(any(OperationGroupPosition.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(assignments.findByOperationEventIdAndUserId(operationId, memberId)).thenReturn(Optional.of(mine));
        when(assignments.setPosition(any(), anyLong(), any())).thenReturn(1);
        when(groups.existsByIdAndPositionMode(2L, OperationGroup.PositionMode.SELF)).thenReturn(true);
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, memberId, 1)).thenReturn(true);
    }

    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

    private void signInAs(UUID userId, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority(role))));
    }

    private static OperationPositionRequest position(String label, Integer capacity) {
        OperationPositionRequest request = new OperationPositionRequest();
        request.setLabel(label);
        request.setCapacity(capacity);
        return request;
    }

    @Test void aMemberOfAFreeCrewChoosesChangesAndLeavesTheirOwnPosition() {
        signInAs(memberId, "ROLE_USER");

        service.setMyPosition(operationId, 11L);
        service.setMyPosition(operationId, null);

        verify(groups, org.mockito.Mockito.times(2)).findLockedById(2L);
        verify(assignments).setPosition(mine.getId(), 2L, 11L);
        verify(assignments).setPosition(mine.getId(), 2L, null);
        // La participation n'est jamais modifiée par un changement de poste.
        verify(participation, never()).save(any());
    }

    @Test void theLastSeatOfAPositionGoesToOneMemberOnly() {
        signInAs(memberId, "ROLE_USER");
        when(assignments.countByPositionIdAndStatusAndUserIdNot(10L, OperationAssignment.Status.CONFIRMED, memberId)).thenReturn(1L);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 10L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("Poste complet");

        verify(assignments, never()).setPosition(any(), anyLong(), any());
    }

    @Test void aPositionWithoutCapacityIsNeverFull() {
        signInAs(memberId, "ROLE_USER");
        when(assignments.countByPositionIdAndStatusAndUserIdNot(11L, OperationAssignment.Status.CONFIRMED, memberId)).thenReturn(40L);

        service.setMyPosition(operationId, 11L);

        verify(assignments).setPosition(mine.getId(), 2L, 11L);
    }

    @Test void aPositionOfAnotherCrewIsRefused() {
        signInAs(memberId, "ROLE_USER");

        assertThatThrownBy(() -> service.setMyPosition(operationId, 20L)).isInstanceOf(IllegalArgumentException.class);

        verify(assignments, never()).setPosition(any(), anyLong(), any());
    }

    @Test void aMemberCannotChooseWhenPositionsAreManaged() {
        signInAs(memberId, "ROLE_USER");
        polaris.setPositionMode(OperationGroup.PositionMode.MANAGED);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.setMyPosition(operationId, null)).isInstanceOf(AccessDeniedException.class);

        verify(assignments, never()).setPosition(any(), anyLong(), any());
    }

    @Test void aMemberWithoutCrewOrNoLongerPresentCannotChoose() {
        signInAs(otherId, "ROLE_USER");
        when(assignments.findByOperationEventIdAndUserId(operationId, otherId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(IllegalStateException.class);

        signInAs(memberId, "ROLE_USER");
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, memberId, 1)).thenReturn(false);
        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("Présent");

        verify(assignments, never()).setPosition(any(), anyLong(), any());
    }

    @Test void aMemberOfAnOrdinaryGroupHasNoPosition() {
        signInAs(memberId, "ROLE_USER");
        mine.setGroupId(4L);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void aDraftDoesNotExistForAMember() {
        signInAs(memberId, "ROLE_USER");
        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.crews(operationId)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.setMemberPosition(operationId, memberId, 11L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void onlyAnOrganizerOrTheResponsibleOfTheCrewAssignsSomeoneElse() {
        signInAs(otherId, "ROLE_USER");
        assertThatThrownBy(() -> service.setMemberPosition(operationId, memberId, 11L)).isInstanceOf(AccessDeniedException.class);
        verify(assignments, never()).setPosition(any(), anyLong(), any());

        signInAs(responsibleId, "ROLE_USER");
        when(assignmentService.hasResponsibleScope(responsibleId, polaris)).thenReturn(true);
        service.setMemberPosition(operationId, memberId, 11L);

        signInAs(otherId, "ROLE_OFFICIER");
        polaris.setPositionMode(OperationGroup.PositionMode.MANAGED);
        service.setMemberPosition(operationId, memberId, null);

        verify(assignments).setPosition(mine.getId(), 2L, 11L);
        verify(assignments).setPosition(mine.getId(), 2L, null);
    }

    @Test void aConcurrentTransferMakesThePositionWriteFail() {
        signInAs(memberId, "ROLE_USER");
        when(assignments.setPosition(mine.getId(), 2L, 11L)).thenReturn(0);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("réessayez");
    }

    @Test void positionsHandedToTheResponsiblesWhileAMemberWasChoosingAreRefusedUnderTheLock() {
        signInAs(memberId, "ROLE_USER");
        when(groups.existsByIdAndPositionMode(2L, OperationGroup.PositionMode.SELF)).thenReturn(false);

        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(AccessDeniedException.class);

        verify(assignments, never()).setPosition(any(), anyLong(), any());
    }

    @Test void aPresetOnlyAppliesToACrewAndAKindChangeIsMadeUnderTheGroupLock() {
        OperationGroupRequest ordinary = new OperationGroupRequest();
        ordinary.setPresetId(UUID.randomUUID());
        assertThatThrownBy(() -> service.configure(OperationGroup.builder().build(), ordinary, true)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("preset");

        OperationGroupRequest toStandard = new OperationGroupRequest();
        toStandard.setKind(OperationGroup.Kind.STANDARD);
        service.configure(polaris, toStandard, false);
        verify(groups).findLockedById(2L);
    }

    @Test void afterTheEndEveryPositionWriteIsRefused() {
        signInAs(otherId, "ROLE_ADMIN");
        doThrow(new OperationClosedException("Opération terminée")).when(lock).requireOpen(operationId);

        assertThatThrownBy(() -> service.setMemberPosition(operationId, memberId, 11L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> service.addPosition(operationId, 2L, position("Ingénieur", 2))).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> service.updatePosition(operationId, 2L, 10L, position("Pilote", 2))).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> service.deletePosition(operationId, 2L, 10L)).isInstanceOf(OperationClosedException.class);
        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> service.setMyPosition(operationId, 11L)).isInstanceOf(OperationClosedException.class);

        verify(assignments, never()).setPosition(any(), anyLong(), any());
        verify(positions, never()).save(any());
        verify(positions, never()).delete(any());
    }

    @Test void positionsAreOptionalNamedAndUniqueInsideACrew() {
        signInAs(otherId, "ROLE_ADMIN");

        service.addPosition(operationId, 2L, position("  Ingénieur ", null));
        verify(positions).save(argThat(saved -> saved.getGroupId().equals(2L) && saved.getLabel().equals("Ingénieur") && saved.getCapacity() == null));

        assertThatThrownBy(() -> service.addPosition(operationId, 2L, position("pilote", 1))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("déjà");
        assertThatThrownBy(() -> service.addPosition(operationId, 2L, position(" ", 1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.addPosition(operationId, 2L, position("Soutien", 0))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.addPosition(operationId, 4L, position("Soutien", 1))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("équipage");
    }

    @Test void aCapacityCannotGoBelowItsOccupantsAndAnOccupiedPositionIsNotDeleted() {
        signInAs(otherId, "ROLE_ADMIN");
        when(assignments.countByPositionIdAndStatus(11L, OperationAssignment.Status.CONFIRMED)).thenReturn(3L);

        assertThatThrownBy(() -> service.updatePosition(operationId, 2L, 11L, position("Artilleur", 2))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("capacité");
        assertThatThrownBy(() -> service.deletePosition(operationId, 2L, 11L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("occupé");
        service.updatePosition(operationId, 2L, 11L, position("Artilleur", 3));

        verify(positions, never()).delete(any());
        assertThat(gunner.getCapacity()).isEqualTo(3);
    }

    @Test void aRequestThatSaysNothingAboutTheKindLeavesTheGroupAsItIs() {
        OperationGroupRequest request = new OperationGroupRequest();
        request.setName("Escorte");

        service.configure(escorte, request, false);
        service.configure(polaris, request, false);

        assertThat(escorte.getKind()).isEqualTo(OperationGroup.Kind.STANDARD);
        assertThat(escorte.getShipModelId()).isNull();
        assertThat(polaris.getKind()).isEqualTo(OperationGroup.Kind.CREW);
        assertThat(polaris.getShipModelName()).isEqualTo("Polaris");
        verify(ships, never()).findById(any());
    }

    @Test void aCrewNeedsACatalogModelAndKeepsItsNameAsASnapshot() {
        OperationGroup group = OperationGroup.builder().operationEventId(operationId).name("Équipage").build();
        OperationGroupRequest request = new OperationGroupRequest();
        request.setKind(OperationGroup.Kind.CREW);
        assertThatThrownBy(() -> service.configure(group, request, true)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("modèle");

        request.setShipModelId(99L);
        assertThatThrownBy(() -> service.configure(group, request, true)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("catalogue");

        Ship ship = new Ship();
        ship.setId(70L);
        ship.setName("Polaris");
        when(ships.findById(70L)).thenReturn(Optional.of(ship));
        request.setShipModelId(70L);
        request.setPositionMode(OperationGroup.PositionMode.MANAGED);
        service.configure(group, request, true);

        assertThat(group.getKind()).isEqualTo(OperationGroup.Kind.CREW);
        assertThat(group.getShipModelName()).isEqualTo("Polaris");
        assertThat(group.getPositionMode()).isEqualTo(OperationGroup.PositionMode.MANAGED);
    }

    @Test void aCrewCannotHaveSubgroupsAndCannotBecomeOrdinaryWhilePositionsAreTaken() {
        OperationGroupRequest toCrew = new OperationGroupRequest();
        toCrew.setKind(OperationGroup.Kind.CREW);
        toCrew.setShipModelId(70L);
        when(groups.existsByParentId(4L)).thenReturn(true);
        assertThatThrownBy(() -> service.configure(escorte, toCrew, false)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("sous-groupes");

        OperationGroupRequest toStandard = new OperationGroupRequest();
        toStandard.setKind(OperationGroup.Kind.STANDARD);
        when(assignments.existsByGroupIdAndPositionIdIsNotNull(2L)).thenReturn(true);
        assertThatThrownBy(() -> service.configure(polaris, toStandard, false)).isInstanceOf(IllegalStateException.class);
        verify(positions, never()).deleteByGroupId(anyLong());

        when(assignments.existsByGroupIdAndPositionIdIsNotNull(2L)).thenReturn(false);
        service.configure(polaris, toStandard, false);
        verify(positions).deleteByGroupId(2L);
        assertThat(polaris.getKind()).isEqualTo(OperationGroup.Kind.STANDARD);
        assertThat(polaris.getShipModelId()).isNull();
    }

    @Test void aPresetIsCopiedIntoTheCrewAndAnotherModelOrAnArchivedPresetIsRefused() {
        UUID presetId = UUID.randomUUID();
        OperationCrewPreset preset = OperationCrewPreset.builder().id(presetId).name("Polaris — Escorte").shipModelId(70L).shipModelName("Polaris")
                .capacity(12).positionMode(OperationGroup.PositionMode.MANAGED).build();
        when(presets.findById(presetId)).thenReturn(Optional.of(preset));
        when(presetPositions.findByPresetIdOrderBySortOrderAscIdAsc(presetId)).thenReturn(List.of(
                OperationCrewPresetPosition.builder().id(1L).presetId(presetId).label("Pilote").capacity(1).sortOrder(0).build(),
                OperationCrewPresetPosition.builder().id(2L).presetId(presetId).label("Artilleur").sortOrder(1).build()));
        Ship ship = new Ship();
        ship.setId(70L);
        ship.setName("Polaris");
        when(ships.findById(70L)).thenReturn(Optional.of(ship));

        OperationGroup group = OperationGroup.builder().operationEventId(operationId).name("Équipage").build();
        OperationGroupRequest request = new OperationGroupRequest();
        request.setKind(OperationGroup.Kind.CREW);
        request.setPresetId(presetId);
        service.configure(group, request, true);
        group.setId(9L);
        service.copyPresetPositions(group, presetId);

        assertThat(group.getCapacity()).isEqualTo(12);
        assertThat(group.getPositionMode()).isEqualTo(OperationGroup.PositionMode.MANAGED);
        // L'équipage suit désormais le preset.
        assertThat(group.getCrewPresetId()).isEqualTo(presetId);
        verify(positions).save(argThat(saved -> saved.getGroupId().equals(9L) && saved.getLabel().equals("Pilote") && Integer.valueOf(1).equals(saved.getCapacity())));
        verify(positions).save(argThat(saved -> saved.getGroupId().equals(9L) && saved.getLabel().equals("Artilleur") && saved.getCapacity() == null));
        // Le preset n'est que lu : la copie ne l'écrit jamais.
        verify(presets, never()).save(any());
        verify(presetPositions, never()).save(any());

        OperationGroupRequest otherModel = new OperationGroupRequest();
        otherModel.setKind(OperationGroup.Kind.CREW);
        otherModel.setPresetId(presetId);
        otherModel.setShipModelId(71L);
        assertThatThrownBy(() -> service.configure(OperationGroup.builder().build(), otherModel, true)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("autre modèle");

        preset.setArchived(true);
        assertThatThrownBy(() -> service.configure(OperationGroup.builder().build(), request, true)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void retouchingAPositionByHandDetachesTheCrewFromItsPreset() {
        UUID presetId = UUID.randomUUID();
        polaris.setCrewPresetId(presetId);
        service.addPosition(operationId, 2L, position("Ingénieur", null));
        assertThat(polaris.getCrewPresetId()).isNull();
        verify(groups).save(polaris);

        polaris.setCrewPresetId(presetId);
        service.updatePosition(operationId, 2L, 10L, position("Pilote", 1));
        assertThat(polaris.getCrewPresetId()).isNull();
    }

    @Test void anExistingCrewTakesThePresetPositionsAndFollowsIt() {
        UUID presetId = UUID.randomUUID();
        OperationCrewPreset preset = OperationCrewPreset.builder().id(presetId).name("Polaris — Standard").shipModelId(70L)
                .capacity(10).positionMode(OperationGroup.PositionMode.SELF).build();
        when(presets.findById(presetId)).thenReturn(Optional.of(preset));
        when(presetPositions.findByPresetIdOrderBySortOrderAscIdAsc(presetId)).thenReturn(List.of(
                OperationCrewPresetPosition.builder().presetId(presetId).label("Pilote").icon("pilot").capacity(1).sortOrder(0).build(),
                OperationCrewPresetPosition.builder().presetId(presetId).label("Torpilleur").icon("missile").capacity(1).sortOrder(1).build(),
                OperationCrewPresetPosition.builder().presetId(presetId).label("Ingénieur").icon("wrench").capacity(1).sortOrder(2).build()));
        when(positions.findByGroupIdOrderBySortOrderAscIdAsc(2L)).thenReturn(new java.util.ArrayList<>(List.of(pilot, gunner)));

        service.followPreset(operationId, 2L, presetId);

        // « Artilleur » n'est pas dans le preset : supprimé, ses membres restent dans l'équipage sans poste.
        verify(positions).delete(gunner);
        verify(positions).save(argThat(saved -> Long.valueOf(10L).equals(saved.getId()) && "pilot".equals(saved.getIcon())));
        verify(positions).save(argThat(saved -> saved.getId() == null && saved.getLabel().equals("Ingénieur") && "wrench".equals(saved.getIcon()) && Integer.valueOf(1).equals(saved.getCapacity())));
        assertThat(polaris.getCrewPresetId()).isEqualTo(presetId);
        assertThat(polaris.getCapacity()).isEqualTo(10);

        assertThatThrownBy(() -> service.followPreset(operationId, 3L, presetId)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("autre modèle");
    }

    @Test void theCrewReadShowsPositionsTakenSeatsAndMembersWithoutPosition() {
        signInAs(memberId, "ROLE_USER");
        mine.setPositionId(11L);
        OperationAssignment noPosition = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(2L).userId(otherId).build();
        OperationAssignment elsewhere = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(responsibleId).build();
        when(assignments.findByOperationEventId(operationId)).thenReturn(List.of(mine, noPosition, elsewhere));
        when(positions.findByGroupIdInOrderBySortOrderAscIdAsc(any())).thenReturn(List.of(pilot, gunner, miner));
        User member = new User();
        member.setId(memberId);
        member.setUsername("Kael");
        when(users.findAllById(any())).thenReturn(List.of(member));

        List<OperationCrewDTO> crews = service.crews(operationId);

        assertThat(crews).extracting(OperationCrewDTO::groupId).containsExactly(2L, 3L);
        OperationCrewDTO crew = crews.get(0);
        // Le modèle a quitté le catalogue : le nom enregistré reste affiché, sans identifiant ni image.
        assertThat(crew.shipModelName()).isEqualTo("Polaris");
        assertThat(crew.shipModelId()).isNull();
        assertThat(crew.manageable()).isFalse();
        assertThat(crew.positions()).extracting(OperationCrewDTO.Position::label, OperationCrewDTO.Position::taken)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Pilote", 0), org.assertj.core.groups.Tuple.tuple("Artilleur", 1));
        assertThat(crew.members()).extracting(OperationCrewDTO.Member::username, OperationCrewDTO.Member::positionId)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Compte désactivé", null), org.assertj.core.groups.Tuple.tuple("Kael", 11L));
    }

    @Test void changingGroupFreesThePositionAndStayingKeepsIt() {
        mine.setPositionId(11L);

        mine.moveTo(2L);
        assertThat(mine.getPositionId()).isEqualTo(11L);

        mine.moveTo(3L);
        assertThat(mine.getGroupId()).isEqualTo(3L);
        assertThat(mine.getPositionId()).isNull();
    }

    @Test void onlyAdministratorsWriteThePresetLibrary() {
        for (String write : List.of("create", "update", "archive", "restore")) {
            var method = Arrays.stream(OperationCrewPresetController.class.getDeclaredMethods()).filter(candidate -> candidate.getName().equals(write)).findFirst().orElseThrow();
            assertThat(method.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasRole('ADMIN')");
        }
        var list = Arrays.stream(OperationCrewPresetController.class.getDeclaredMethods()).filter(candidate -> candidate.getName().equals("list")).findFirst().orElseThrow();
        assertThat(list.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasAnyRole('ADMIN', 'OFFICIER')");
    }
}
