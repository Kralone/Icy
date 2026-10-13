package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.event.OperationOrganizationDTO;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Lecture de la structure d'une opération pour l'éditeur de l'organisateur (brouillon ou publiée). */
@Service
@RequiredArgsConstructor
public class OperationOrganizationService {
    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final OperationAssignmentRepository assignmentRepository;
    private final OperationAssignmentRequestRepository requestRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public OperationOrganizationDTO organization(UUID operationId) {
        Operation operation = operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        Map<Long, OperationGroup> byId = groups.stream().collect(Collectors.toMap(OperationGroup::getId, Function.identity()));
        List<OperationAssignment> confirmed = assignmentRepository.findByOperationEventId(operationId).stream()
                .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED).toList();
        List<OperationAssignmentRequest> pending = requestRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId).stream()
                .filter(request -> request.getStatus() == OperationAssignmentRequest.Status.PENDING).toList();

        Set<UUID> userIds = new HashSet<>();
        confirmed.forEach(assignment -> userIds.add(assignment.getUserId()));
        groups.stream().map(OperationGroup::getResponsibleUserId).filter(Objects::nonNull).forEach(userIds::add);
        Map<UUID, String> usernames = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getUsername));

        // Effectif de chaque groupe, sous-groupes compris : c'est lui que les capacités plafonnent.
        Map<Long, Integer> headcount = groups.stream().collect(Collectors.toMap(OperationGroup::getId, group -> (int) confirmed.stream()
                .filter(assignment -> group.getId().equals(assignment.getGroupId())
                        || (byId.get(assignment.getGroupId()) != null && group.getId().equals(byId.get(assignment.getGroupId()).getParentId())))
                .map(OperationAssignment::getUserId).distinct().count()));

        List<OperationOrganizationDTO.Group> nodes = groups.stream().map(group -> {
            Set<Long> subtree = groups.stream()
                    .filter(candidate -> group.getId().equals(candidate.getId()) || group.getId().equals(candidate.getParentId()))
                    .map(OperationGroup::getId).collect(Collectors.toSet());
            int memberCount = headcount.get(group.getId());
            List<OperationOrganizationDTO.Member> members = confirmed.stream()
                    .filter(assignment -> group.getId().equals(assignment.getGroupId()))
                    .map(assignment -> new OperationOrganizationDTO.Member(assignment.getUserId(), usernames.getOrDefault(assignment.getUserId(), "Compte désactivé")))
                    .sorted(java.util.Comparator.comparing(OperationOrganizationDTO.Member::username, String.CASE_INSENSITIVE_ORDER))
                    .toList();
            int pendingRequests = (int) pending.stream().filter(request -> subtree.contains(request.getGroupId())).count();
            boolean container = groups.stream().anyMatch(candidate -> group.getId().equals(candidate.getParentId()));
            return new OperationOrganizationDTO.Group(group.getId(), group.getParentId(), group.getName(), group.getDescription(), group.getCapacity(),
                    group.getAssignmentMode(), effectiveMode(group, byId, operation.getDefaultAssignmentMode()), group.getSortOrder(),
                    group.getResponsibleUserId(), group.getResponsibleUserId() == null ? null : usernames.get(group.getResponsibleUserId()),
                    container, memberCount, members, pendingRequests, freeSeats(group, byId, headcount), ownFreeSeats(group, headcount));
        }).toList();
        return new OperationOrganizationDTO(operation.getDefaultAssignmentMode(), nodes);
    }

    private static Integer ownFreeSeats(OperationGroup group, Map<Long, Integer> headcount) {
        return group.getCapacity() == null ? null : Math.max(0, group.getCapacity() - headcount.getOrDefault(group.getId(), 0));
    }

    /** La plus petite marge entre le groupe et son groupe principal : c'est ce qu'un nouveau membre peut réellement prendre. */
    private static Integer freeSeats(OperationGroup group, Map<Long, OperationGroup> byId, Map<Long, Integer> headcount) {
        Integer own = ownFreeSeats(group, headcount);
        OperationGroup parent = group.getParentId() == null ? null : byId.get(group.getParentId());
        Integer above = parent == null ? null : ownFreeSeats(parent, headcount);
        if (own == null) return above;
        return above == null ? own : Math.min(own, above);
    }

    /** Même règle que pour les affectations : le groupe, sinon son parent, sinon l'opération. */
    private OperationGroup.AssignmentMode effectiveMode(OperationGroup group, Map<Long, OperationGroup> byId, OperationGroup.AssignmentMode operationDefault) {
        OperationGroup cursor = group;
        int depth = 0;
        while (cursor != null && depth++ <= 2) {
            if (cursor.getAssignmentMode() != OperationGroup.AssignmentMode.INHERITED) return cursor.getAssignmentMode();
            cursor = cursor.getParentId() == null ? null : byId.get(cursor.getParentId());
        }
        return operationDefault;
    }
}
