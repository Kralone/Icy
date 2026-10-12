package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.event.OperationCoordinationDTO;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Lecture du tableau de coordination, pour un organisateur ou pour un responsable de groupe. */
@Service
@RequiredArgsConstructor
public class OperationCoordinationService {
    private static final Comparator<OperationCoordinationDTO.Member> BY_NAME = Comparator.comparing(OperationCoordinationDTO.Member::username, String.CASE_INSENSITIVE_ORDER);

    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final OperationAssignmentRepository assignmentRepository;
    private final OperationAssignmentRequestRepository requestRepository;
    private final EventParticipationRepository participationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public OperationCoordinationDTO coordination(UUID operationId) {
        boolean organizer = AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER");
        // Pour un non-organisateur, un brouillon n'existe pas.
        Operation operation = operationRepository.findById(operationId)
                .filter(value -> organizer || value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        Map<Long, OperationGroup> byId = groups.stream().collect(Collectors.toMap(OperationGroup::getId, Function.identity()));

        UUID currentUser = AuthUtils.getCurrentUserId();
        Set<Long> scope = organizer ? byId.keySet() : delegatedScope(currentUser, groups);
        if (!organizer && scope.isEmpty()) throw new AccessDeniedException("Aucun groupe ne vous est délégué");

        List<EventParticipationRepository.ActiveParticipation> participations = participationRepository.findActiveByEventId(operationId);
        List<OperationAssignment> confirmed = assignmentRepository.findByOperationEventId(operationId).stream()
                .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED).toList();
        List<OperationAssignmentRequest> pending = requestRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId).stream()
                .filter(request -> request.getStatus() == OperationAssignmentRequest.Status.PENDING && scope.contains(request.getGroupId())).toList();

        Set<UUID> userIds = new HashSet<>();
        confirmed.forEach(assignment -> userIds.add(assignment.getUserId()));
        pending.forEach(request -> userIds.add(request.getUserId()));
        groups.stream().map(OperationGroup::getResponsibleUserId).filter(Objects::nonNull).forEach(userIds::add);
        Map<UUID, String> usernames = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getUsername));
        participations.forEach(participation -> usernames.putIfAbsent(participation.getUserId(), participation.getUsername()));
        Function<UUID, OperationCoordinationDTO.Member> member = id -> new OperationCoordinationDTO.Member(id, usernames.getOrDefault(id, "Compte désactivé"));

        Map<UUID, Long> groupOfUser = confirmed.stream().collect(Collectors.toMap(OperationAssignment::getUserId, OperationAssignment::getGroupId, (first, second) -> first));
        List<OperationCoordinationDTO.Member> present = byStatus(participations, 1, member);
        List<OperationCoordinationDTO.Member> unassigned = present.stream().filter(candidate -> !groupOfUser.containsKey(candidate.userId())).toList();

        Map<Long, Integer> headcount = groups.stream().collect(Collectors.toMap(OperationGroup::getId, group -> (int) confirmed.stream()
                .filter(assignment -> group.getId().equals(assignment.getGroupId()) || group.getId().equals(parentOf(byId, assignment.getGroupId())))
                .map(OperationAssignment::getUserId).distinct().count()));

        List<OperationCoordinationDTO.Group> nodes = groups.stream()
                // Un responsable voit ses groupes et, pour garder la hiérarchie lisible, le groupe parent de ses sous-groupes.
                .filter(group -> organizer || scope.contains(group.getId()) || groups.stream().anyMatch(child -> group.getId().equals(child.getParentId()) && scope.contains(child.getId())))
                .map(group -> {
                    boolean container = groups.stream().anyMatch(candidate -> group.getId().equals(candidate.getParentId()));
                    List<OperationCoordinationDTO.Member> members = !scope.contains(group.getId()) ? List.of() : confirmed.stream()
                            .filter(assignment -> group.getId().equals(assignment.getGroupId()))
                            .map(assignment -> member.apply(assignment.getUserId())).sorted(BY_NAME).toList();
                    return new OperationCoordinationDTO.Group(group.getId(), group.getParentId(), group.getName(), group.getCapacity(),
                            effectiveMode(group, byId, operation.getDefaultAssignmentMode()), container, headcount.get(group.getId()),
                            freeSeats(group, byId, headcount),
                            group.getCapacity() == null ? null : Math.max(0, group.getCapacity() - headcount.getOrDefault(group.getId(), 0)),
                            group.getResponsibleUserId() == null ? null : usernames.get(group.getResponsibleUserId()),
                            scope.contains(group.getId()) && !container, members);
                }).toList();

        List<OperationCoordinationDTO.Request> requests = pending.stream().map(request -> {
            Long current = groupOfUser.get(request.getUserId());
            return new OperationCoordinationDTO.Request(request.getId(), member.apply(request.getUserId()), request.getGroupId(),
                    byId.get(request.getGroupId()) == null ? "Groupe" : byId.get(request.getGroupId()).getName(),
                    current == null || byId.get(current) == null ? null : current,
                    current == null || byId.get(current) == null ? null : byId.get(current).getName(),
                    request.getCreatedAt() == null ? null : request.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant());
        }).toList();

        return new OperationCoordinationDTO(organizer, present, byStatus(participations, 0, member), byStatus(participations, -1, member), unassigned, nodes, requests);
    }

    /** Composition complète, en lecture, pour tout membre : une opération non publiée n'existe pas, pour personne ici. */
    @Transactional(readOnly = true)
    public com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO composition(UUID operationId) {
        Operation operation = operationRepository.findById(operationId)
                .filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        Map<Long, OperationGroup> byId = groups.stream().collect(Collectors.toMap(OperationGroup::getId, Function.identity()));
        UUID currentUser = AuthUtils.getCurrentUserId();

        List<OperationAssignment> confirmed = assignmentRepository.findByOperationEventId(operationId).stream()
                .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED).toList();
        Set<UUID> userIds = new HashSet<>();
        confirmed.forEach(assignment -> userIds.add(assignment.getUserId()));
        groups.stream().map(OperationGroup::getResponsibleUserId).filter(Objects::nonNull).forEach(userIds::add);
        Map<UUID, String> usernames = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getUsername));

        Map<Long, Integer> headcount = groups.stream().collect(Collectors.toMap(OperationGroup::getId, group -> (int) confirmed.stream()
                .filter(assignment -> group.getId().equals(assignment.getGroupId()) || group.getId().equals(parentOf(byId, assignment.getGroupId())))
                .map(OperationAssignment::getUserId).distinct().count()));

        var nodes = groups.stream().map(group -> new com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO.Group(
                group.getId(), group.getParentId(), group.getName(), group.getDescription(), group.getCapacity(),
                effectiveMode(group, byId, operation.getDefaultAssignmentMode()),
                groups.stream().anyMatch(candidate -> group.getId().equals(candidate.getParentId())),
                headcount.get(group.getId()), freeSeats(group, byId, headcount),
                group.getCapacity() == null ? null : Math.max(0, group.getCapacity() - headcount.getOrDefault(group.getId(), 0)),
                group.getResponsibleUserId() == null ? null : usernames.getOrDefault(group.getResponsibleUserId(), "Compte désactivé"),
                confirmed.stream().filter(assignment -> group.getId().equals(assignment.getGroupId()))
                        .map(assignment -> new com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO.Member(assignment.getUserId(), usernames.getOrDefault(assignment.getUserId(), "Compte désactivé")))
                        .sorted(Comparator.comparing(com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO.Member::username, String.CASE_INSENSITIVE_ORDER)).toList())).toList();

        Long myGroupId = confirmed.stream().filter(assignment -> currentUser.equals(assignment.getUserId())).map(OperationAssignment::getGroupId).findFirst().orElse(null);
        var myRequest = requestRepository.findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(operationId, currentUser, OperationAssignmentRequest.Status.PENDING)
                .map(request -> new com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO.MyRequest(request.getId(), request.getGroupId(),
                        byId.get(request.getGroupId()) == null ? "Groupe" : byId.get(request.getGroupId()).getName(),
                        request.getCreatedAt() == null ? null : request.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant()))
                .orElse(null);
        return new com.icy.icy_backend.controller.dto.response.event.OperationCompositionDTO(
                participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, currentUser, 1), myGroupId, myRequest, nodes);
    }

    private static List<OperationCoordinationDTO.Member> byStatus(List<EventParticipationRepository.ActiveParticipation> participations, int status, Function<UUID, OperationCoordinationDTO.Member> member) {
        return participations.stream().filter(participation -> participation.getStatus() == status)
                .map(participation -> member.apply(participation.getUserId())).sorted(BY_NAME).toList();
    }

    private static Long parentOf(Map<Long, OperationGroup> byId, Long groupId) {
        OperationGroup group = byId.get(groupId);
        return group == null ? null : group.getParentId();
    }

    /** Groupes dont l'utilisateur est responsable, et leurs sous-groupes. */
    private static Set<Long> delegatedScope(UUID userId, List<OperationGroup> groups) {
        Set<Long> own = groups.stream().filter(group -> userId.equals(group.getResponsibleUserId())).map(OperationGroup::getId).collect(Collectors.toCollection(HashSet::new));
        groups.stream().filter(group -> group.getParentId() != null && own.contains(group.getParentId())).map(OperationGroup::getId).toList().forEach(own::add);
        return own;
    }

    private static Integer freeSeats(OperationGroup group, Map<Long, OperationGroup> byId, Map<Long, Integer> headcount) {
        Integer free = null;
        for (OperationGroup cursor = group; cursor != null; cursor = cursor.getParentId() == null ? null : byId.get(cursor.getParentId())) {
            if (cursor.getCapacity() == null) continue;
            int left = Math.max(0, cursor.getCapacity() - headcount.getOrDefault(cursor.getId(), 0));
            free = free == null ? left : Math.min(free, left);
        }
        return free;
    }

    private static OperationGroup.AssignmentMode effectiveMode(OperationGroup group, Map<Long, OperationGroup> byId, OperationGroup.AssignmentMode operationDefault) {
        OperationGroup cursor = group;
        int depth = 0;
        while (cursor != null && depth++ <= 2) {
            if (cursor.getAssignmentMode() != OperationGroup.AssignmentMode.INHERITED) return cursor.getAssignmentMode();
            cursor = cursor.getParentId() == null ? null : byId.get(cursor.getParentId());
        }
        return operationDefault;
    }
}
