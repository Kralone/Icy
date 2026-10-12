package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.response.event.OperationCoordinationDTO;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Lot 3B : placement des membres par un organisateur ou un responsable délégué, et lecture de la coordination. */
class OperationMemberAssignmentTest {
    private final UUID operationId = UUID.randomUUID();
    private final UUID organizerId = UUID.randomUUID();
    private final UUID responsibleId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID otherMemberId = UUID.randomUUID();

    private final OperationRepository operations = mock(OperationRepository.class);
    private final OperationGroupRepository groups = mock(OperationGroupRepository.class);
    private final OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
    private final OperationAssignmentRequestRepository requests = mock(OperationAssignmentRequestRepository.class);
    private final EventParticipationRepository participation = mock(EventParticipationRepository.class);
    private final EventRepository events = mock(EventRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).build();

    // Alpha (plafond 2, responsable délégué) contient Polaris (géré) et Escadrille ; Bravo est un groupe feuille hors délégation.
    private final OperationGroup alpha = OperationGroup.builder().id(1L).operationEventId(operationId).name("Alpha").capacity(2).responsibleUserId(responsibleId).build();
    private final OperationGroup polaris = OperationGroup.builder().id(2L).operationEventId(operationId).parentId(1L).name("Polaris").assignmentMode(OperationGroup.AssignmentMode.MANAGED).build();
    private final OperationGroup escadrille = OperationGroup.builder().id(3L).operationEventId(operationId).parentId(1L).name("Escadrille").build();
    private final OperationGroup bravo = OperationGroup.builder().id(4L).operationEventId(operationId).name("Bravo").build();
    private final List<OperationAssignment> stored = new ArrayList<>();

    private final OperationAssignmentService service = new OperationAssignmentService(operations, groups, assignments, events, participation, mock(MessageService.class), requests);

    OperationMemberAssignmentTest() {
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        List<OperationGroup> all = List.of(alpha, polaris, escadrille, bravo);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(all);
        for (OperationGroup group : all) {
            when(groups.findById(group.getId())).thenReturn(Optional.of(group));
            when(groups.findLockedById(group.getId())).thenReturn(Optional.of(group));
        }
        when(groups.existsByParentId(1L)).thenReturn(true);
        when(assignments.findByOperationEventId(operationId)).thenAnswer(invocation -> List.copyOf(stored));
        when(assignments.findByOperationEventIdAndUserId(any(), any())).thenAnswer(invocation ->
                stored.stream().filter(assignment -> assignment.getUserId().equals(invocation.getArgument(1))).findFirst());
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, memberId, 1)).thenReturn(true);
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, otherMemberId, 1)).thenReturn(true);
    }

    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

    private void signInAs(UUID userId, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority(role))));
    }

    private OperationAssignment place(UUID userId, long groupId) {
        OperationAssignment assignment = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(groupId).userId(userId).build();
        stored.add(assignment);
        return assignment;
    }

    @Test void organizerPlacesAPresentMemberInAManagedGroupAndClearsTheirPendingRequest() {
        signInAs(organizerId, "ROLE_OFFICIER");

        service.assignMember(operationId, memberId, 2L);

        verify(assignments).save(org.mockito.ArgumentMatchers.argThat(assignment -> assignment.getGroupId().equals(2L) && assignment.getUserId().equals(memberId)
                && assignment.getStatus() == OperationAssignment.Status.CONFIRMED));
        verify(requests).deleteByOperationEventIdAndUserIdAndStatus(operationId, memberId, OperationAssignmentRequest.Status.PENDING);
    }

    @Test void movingAMemberReusesTheirSingleAssignment() {
        signInAs(organizerId, "ROLE_ADMIN");
        OperationAssignment current = place(memberId, 4L);

        service.assignMember(operationId, memberId, 3L);

        assertThat(current.getGroupId()).isEqualTo(3L);
        verify(assignments).save(current);
    }

    @Test void refusesAContainerAMemberWhoIsNotPresentAndAFullParent() {
        signInAs(organizerId, "ROLE_ADMIN");
        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 1L)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("feuille");
        assertThatThrownBy(() -> service.assignMember(operationId, UUID.randomUUID(), 2L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("Présent");

        place(UUID.randomUUID(), 2L);
        place(UUID.randomUUID(), 3L);
        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 3L)).isInstanceOf(IllegalStateException.class).hasMessage("Groupe complet");
        verify(assignments, never()).save(any());
    }

    @Test void aResponsibleManagesOnlyTheGroupsDelegatedToThem() {
        signInAs(responsibleId, "ROLE_USER");

        service.assignMember(operationId, memberId, 2L);
        verify(assignments).save(any(OperationAssignment.class));

        assertThatThrownBy(() -> service.assignMember(operationId, otherMemberId, 4L)).isInstanceOf(AccessDeniedException.class);

        OperationAssignment outside = place(otherMemberId, 4L);
        assertThatThrownBy(() -> service.assignMember(operationId, otherMemberId, 3L)).isInstanceOf(AccessDeniedException.class).hasMessageContaining("hors de votre délégation");
        assertThatThrownBy(() -> service.removeMember(operationId, otherMemberId)).isInstanceOf(AccessDeniedException.class);
        assertThat(outside.getGroupId()).isEqualTo(4L);
        verify(assignments, never()).delete(any());

        OperationAssignment inside = place(memberId, 3L);
        service.removeMember(operationId, memberId);
        verify(assignments).delete(inside);
    }

    @Test void anOrdinaryMemberCannotPlaceOrRemoveAnyoneAndADraftDoesNotExistForThem() {
        signInAs(memberId, "ROLE_USER");
        place(otherMemberId, 3L);
        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 3L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.removeMember(operationId, otherMemberId)).isInstanceOf(AccessDeniedException.class);
        // Même refus pour un membre sans affectation : la réponse ne révèle rien.
        assertThatThrownBy(() -> service.removeMember(operationId, UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);

        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 3L)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.removeMember(operationId, otherMemberId)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void aRequestIsNotApprovedOnceTheMemberIsNoLongerPresent() {
        signInAs(organizerId, "ROLE_ADMIN");
        UUID requestId = UUID.randomUUID();
        UUID absent = UUID.randomUUID();
        OperationAssignmentRequest request = OperationAssignmentRequest.builder().id(requestId).operationEventId(operationId).groupId(3L).userId(absent).build();
        when(requests.findById(requestId)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> service.decide(requestId, true)).isInstanceOf(IllegalStateException.class).hasMessageContaining("plus inscrit Présent");
        assertThat(request.getStatus()).isEqualTo(OperationAssignmentRequest.Status.PENDING);
    }

    @Test void aGroupMovedUnderANewParentMustFitItsCapacity() {
        OperationGroupService groupService = new OperationGroupService(operations, groups, mock(MessageService.class), assignments);
        when(groups.existsByParentId(4L)).thenReturn(false);
        place(memberId, 3L);
        place(otherMemberId, 4L);
        place(UUID.randomUUID(), 4L);
        OperationGroupRequest move = new OperationGroupRequest();
        move.setName("Bravo");
        move.setParentId(1L);
        move.setAssignmentMode(OperationGroup.AssignmentMode.INHERITED);

        assertThatThrownBy(() -> groupService.update(operationId, 4L, move)).isInstanceOf(IllegalStateException.class).hasMessageContaining("pas assez de places");
        assertThat(bravo.getParentId()).isNull();
        verify(groups).findLockedById(1L);
        verify(groups).findLockedById(4L);
    }

    @Test void aDeactivatedAccountGetsNoNewAssignmentOrTransferButKeepsItsHistoricalOne() {
        when(participation.isDeactivatedParticipant(operationId, memberId)).thenReturn(true);
        OperationAssignment historical = place(memberId, 3L);

        // Placement et transfert par un organisateur.
        signInAs(organizerId, "ROLE_ADMIN");
        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 4L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("compte est désactivé");

        // Approbation d'une demande restée en attente.
        UUID requestId = UUID.randomUUID();
        OperationAssignmentRequest pending = OperationAssignmentRequest.builder().id(requestId).operationEventId(operationId).groupId(4L).userId(memberId).build();
        when(requests.findById(requestId)).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.decide(requestId, true)).isInstanceOf(IllegalStateException.class).hasMessageContaining("compte est désactivé");
        assertThat(pending.getStatus()).isEqualTo(OperationAssignmentRequest.Status.PENDING);

        // Le compte lui-même, tant que son jeton est encore valide.
        when(events.findById(operationId)).thenReturn(Optional.of(com.icy.icy_backend.db.entity.event.Event.builder().id(operationId).build()));
        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> service.assign(operationId, 4L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("compte est désactivé");
        escadrille.setAssignmentMode(OperationGroup.AssignmentMode.VALIDATION);
        assertThatThrownBy(() -> service.request(operationId, 3L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("compte est désactivé");

        // L'affectation déjà en place reste, et un organisateur peut toujours la retirer.
        assertThat(historical.getGroupId()).isEqualTo(3L);
        verify(assignments, never()).save(any());
        verify(assignments, never()).delete(any());
        signInAs(organizerId, "ROLE_ADMIN");
        service.removeMember(operationId, memberId);
        verify(assignments).delete(historical);
    }

    @Test void anAssignmentIsRefusedWhenItsGroupWasMovedWhileItWaited() {
        signInAs(organizerId, "ROLE_ADMIN");
        when(groups.existsByIdAndParentIdIsNotNull(4L)).thenReturn(true);

        assertThatThrownBy(() -> service.assignMember(operationId, memberId, 4L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("vient d’être modifiée");
        verify(assignments, never()).save(any());
    }

    @Test void placingAMemberWhereTheyAlreadyAreKeepsTheirTransferRequest() {
        signInAs(responsibleId, "ROLE_USER");
        place(memberId, 3L);

        service.assignMember(operationId, memberId, 3L);

        verify(assignments, never()).save(any());
        verify(requests, never()).deleteByOperationEventIdAndUserIdAndStatus(any(), any(), any());
    }

    @Test void coordinationShowsAResponsibleOnlyWhatTheyManage() {
        User member = user(memberId, "Mira"), other = user(otherMemberId, "Thorn"), responsible = user(responsibleId, "Faramir");
        when(users.findAllById(any())).thenReturn(List.of(member, other, responsible));
        when(participation.findActiveByEventId(operationId)).thenReturn(List.of(participation(member, 1), participation(other, 1), participation(responsible, 0)));
        place(otherMemberId, 4L);
        when(requests.findByOperationEventIdOrderByCreatedAtAsc(operationId)).thenReturn(List.of(
                OperationAssignmentRequest.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(3L).userId(otherMemberId).build(),
                OperationAssignmentRequest.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(memberId).build()));
        OperationCoordinationService coordination = new OperationCoordinationService(operations, groups, assignments, requests, participation, users);

        signInAs(responsibleId, "ROLE_USER");
        OperationCoordinationDTO scoped = coordination.coordination(operationId);
        assertThat(scoped.organizer()).isFalse();
        assertThat(scoped.groups()).extracting(OperationCoordinationDTO.Group::name).containsExactly("Alpha", "Polaris", "Escadrille");
        assertThat(scoped.groups()).filteredOn(OperationCoordinationDTO.Group::manageable).extracting(OperationCoordinationDTO.Group::name).containsExactly("Polaris", "Escadrille");
        assertThat(scoped.requests()).hasSize(1);
        assertThat(scoped.requests().get(0).groupName()).isEqualTo("Escadrille");
        assertThat(scoped.requests().get(0).currentGroupName()).isEqualTo("Bravo");
        assertThat(scoped.unassigned()).extracting(OperationCoordinationDTO.Member::username).containsExactly("Mira");
        assertThat(scoped.maybe()).extracting(OperationCoordinationDTO.Member::username).containsExactly("Faramir");

        signInAs(organizerId, "ROLE_OFFICIER");
        OperationCoordinationDTO full = coordination.coordination(operationId);
        assertThat(full.groups()).hasSize(4);
        assertThat(full.requests()).hasSize(2);
        assertThat(full.groups()).filteredOn(group -> group.name().equals("Escadrille")).extracting(OperationCoordinationDTO.Group::freeSeats).containsExactly(2);
        assertThat(full.groups()).filteredOn(group -> group.name().equals("Escadrille")).extracting(OperationCoordinationDTO.Group::ownFreeSeats).containsOnlyNulls();
        assertThat(full.requests()).extracting(OperationCoordinationDTO.Request::currentGroupId).contains(4L);

        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> coordination.coordination(operationId)).isInstanceOf(AccessDeniedException.class);
        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        assertThatThrownBy(() -> coordination.coordination(operationId)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void anyMemberReadsTheWholeCompositionAndTheirOwnSituationButNeverADraft() {
        when(users.findAllById(any())).thenReturn(List.of(user(memberId, "Mira"), user(otherMemberId, "Thorn"), user(responsibleId, "Faramir")));
        place(memberId, 2L);
        place(otherMemberId, 3L);
        OperationAssignmentRequest transfer = OperationAssignmentRequest.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(memberId).build();
        when(requests.findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(operationId, memberId, OperationAssignmentRequest.Status.PENDING)).thenReturn(Optional.of(transfer));
        OperationCoordinationService coordination = new OperationCoordinationService(operations, groups, assignments, requests, participation, users);

        signInAs(memberId, "ROLE_USER");
        var composition = coordination.composition(operationId);
        assertThat(composition.present()).isTrue();
        assertThat(composition.myGroupId()).isEqualTo(2L);
        // La demande de transfert n'a pas retiré la place actuelle.
        assertThat(composition.myRequest().groupName()).isEqualTo("Bravo");
        assertThat(composition.groups()).extracting(group -> group.name() + ":" + group.memberCount() + ":" + group.container())
                .containsExactly("Alpha:2:true", "Polaris:1:false", "Escadrille:1:false", "Bravo:0:false");
        assertThat(composition.groups().get(0).freeSeats()).isZero();
        assertThat(composition.groups().get(0).responsibleUsername()).isEqualTo("Faramir");
        assertThat(composition.groups().get(1).members()).extracting(member -> member.username()).containsExactly("Mira");
        assertThat(composition.groups().get(1).effectiveMode()).isEqualTo(OperationGroup.AssignmentMode.MANAGED);

        // Un membre qui n'a pas répondu lit la même composition, sans situation personnelle.
        signInAs(UUID.randomUUID(), "ROLE_USER");
        var visitor = coordination.composition(operationId);
        assertThat(visitor.present()).isFalse();
        assertThat(visitor.myGroupId()).isNull();
        assertThat(visitor.myRequest()).isNull();
        assertThat(visitor.groups()).hasSize(4);

        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        assertThatThrownBy(() -> coordination.composition(operationId)).isInstanceOf(ResourceNotFoundException.class);
        signInAs(organizerId, "ROLE_ADMIN");
        assertThatThrownBy(() -> coordination.composition(operationId)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void aParticipantLeavesTheirGroupOrCancelsTheirRequestAndNothingElse() {
        signInAs(memberId, "ROLE_USER");
        OperationAssignment mine = place(memberId, 3L);
        OperationAssignmentRequest pending = OperationAssignmentRequest.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(memberId).build();
        when(requests.findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(operationId, memberId, OperationAssignmentRequest.Status.PENDING)).thenReturn(Optional.of(pending));

        // Demander son propre groupe n'a pas de sens ; une demande ailleurs existe déjà.
        when(groups.findLockedById(3L)).thenReturn(Optional.of(escadrille));
        escadrille.setAssignmentMode(OperationGroup.AssignmentMode.VALIDATION);
        assertThatThrownBy(() -> service.request(operationId, 3L)).isInstanceOf(IllegalStateException.class).hasMessageContaining("déjà dans ce groupe");

        service.cancelRequest(operationId);
        verify(requests).delete(pending);
        verify(assignments, never()).delete(any());

        service.leave(operationId);
        verify(assignments).delete(mine);
        verify(participation, never()).save(any());

        signInAs(otherMemberId, "ROLE_USER");
        assertThatThrownBy(() -> service.leave(operationId)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.cancelRequest(operationId)).isInstanceOf(ResourceNotFoundException.class);

        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> service.leave(operationId)).isInstanceOf(ResourceNotFoundException.class).hasMessage("Opération introuvable");
        assertThatThrownBy(() -> service.cancelRequest(operationId)).isInstanceOf(ResourceNotFoundException.class).hasMessage("Opération introuvable");
    }

    @Test void theEditorStructureCarriesServerSideSeatsIncludingTheMainGroupCeiling() {
        when(users.findAllById(any())).thenReturn(List.of(user(memberId, "Mira"), user(otherMemberId, "Thorn"), user(responsibleId, "Faramir")));
        when(requests.findByOperationEventIdOrderByCreatedAtAsc(operationId)).thenReturn(List.of());
        escadrille.setCapacity(5);
        place(memberId, 2L);
        place(otherMemberId, 3L);
        var organization = new OperationOrganizationService(operations, groups, assignments, requests, users).organization(operationId);

        // Alpha (2 places) est plein : ses sous-groupes n'ont plus de place, même Escadrille qui en garde 4 en propre.
        assertThat(organization.groups()).extracting(group -> group.name() + ":" + group.memberCount() + ":" + group.freeSeats() + ":" + group.ownFreeSeats())
                .containsExactly("Alpha:2:0:0", "Polaris:1:0:null", "Escadrille:1:0:4", "Bravo:0:null:null");
    }

    private static User user(UUID id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    private static EventParticipationRepository.ActiveParticipation participation(User user, int status) {
        return new EventParticipationRepository.ActiveParticipation() {
            @Override public UUID getUserId() { return user.getId(); }
            @Override public String getUsername() { return user.getUsername(); }
            @Override public int getStatus() { return status; }
        };
    }
}
