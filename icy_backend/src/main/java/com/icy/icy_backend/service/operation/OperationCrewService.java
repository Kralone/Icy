package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.operation.OperationPositionRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationCrewDTO;
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
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Équipages de vaisseau : un groupe spécialisé, ses postes facultatifs et le poste de chaque membre.
 * Le poste est un attribut de l'affectation principale ; il ne crée ni groupe ni seconde affectation.
 */
@Service
@RequiredArgsConstructor
public class OperationCrewService {
    static final int MAX_POSITIONS = 30;
    private static final Pattern ICON = Pattern.compile("^[a-z0-9-]{1,40}$");

    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final OperationGroupPositionRepository positionRepository;
    private final OperationAssignmentRepository assignmentRepository;
    private final OperationCrewPresetRepository presetRepository;
    private final OperationCrewPresetPositionRepository presetPositionRepository;
    private final EventParticipationRepository participationRepository;
    private final UserRepository userRepository;
    private final ShipRepository shipRepository;
    private final OperationAssignmentService assignmentService;
    private final OperationLock operationLock;
    private final MessageService messageService;

    private static boolean organizer() {
        return AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER");
    }

    /** Pour un non-organisateur, un brouillon n'existe pas. */
    private Operation visibleOperation(UUID operationId) {
        boolean organizer = organizer();
        return operationRepository.findById(operationId)
                .filter(value -> organizer || value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
    }

    private OperationGroup crewGroup(UUID operationId, Long groupId) {
        OperationGroup group = groupRepository.findById(groupId).filter(value -> operationId.equals(value.getOperationEventId()))
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (group.getKind() != OperationGroup.Kind.CREW) throw new IllegalArgumentException("Ce groupe n’est pas un équipage de vaisseau");
        return group;
    }

    @Transactional(readOnly = true)
    public List<OperationCrewDTO> crews(UUID operationId) {
        visibleOperation(operationId);
        List<OperationGroup> crews = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId).stream()
                .filter(group -> group.getKind() == OperationGroup.Kind.CREW).toList();
        if (crews.isEmpty()) return List.of();
        Set<Long> crewIds = crews.stream().map(OperationGroup::getId).collect(Collectors.toSet());
        List<OperationGroupPosition> positions = positionRepository.findByGroupIdInOrderBySortOrderAscIdAsc(crewIds);
        List<OperationAssignment> confirmed = assignmentRepository.findByOperationEventId(operationId).stream()
                .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED && crewIds.contains(assignment.getGroupId())).toList();
        Map<UUID, String> usernames = userRepository.findAllById(confirmed.stream().map(OperationAssignment::getUserId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, User::getUsername));
        Map<Long, Ship> ships = shipRepository.findAllById(crews.stream().map(OperationGroup::getShipModelId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Ship::getId, Function.identity()));
        boolean organizer = organizer();
        UUID currentUser = AuthUtils.getCurrentUserId();

        return crews.stream().map(group -> {
            Ship ship = group.getShipModelId() == null ? null : ships.get(group.getShipModelId());
            List<OperationCrewDTO.Member> members = confirmed.stream().filter(assignment -> group.getId().equals(assignment.getGroupId()))
                    .map(assignment -> new OperationCrewDTO.Member(assignment.getUserId(), usernames.getOrDefault(assignment.getUserId(), "Compte désactivé"), assignment.getPositionId()))
                    .sorted(Comparator.comparing(OperationCrewDTO.Member::username, String.CASE_INSENSITIVE_ORDER)).toList();
            List<OperationCrewDTO.Position> crewPositions = positions.stream().filter(position -> group.getId().equals(position.getGroupId()))
                    .map(position -> new OperationCrewDTO.Position(position.getId(), position.getLabel(), position.getIcon(), position.getCapacity(),
                            (int) members.stream().filter(member -> position.getId().equals(member.positionId())).count(), position.getSortOrder()))
                    .toList();
            return new OperationCrewDTO(group.getId(), ship == null ? null : group.getShipModelId(),
                    ship == null ? group.getShipModelName() : ship.getName(), ship == null ? null : ship.getImageUrl(),
                    group.getPositionMode(), organizer || assignmentService.hasResponsibleScope(currentUser, group), crewPositions, members);
        }).toList();
    }

    /**
     * Applique à un groupe la partie « équipage » d'une demande de création ou de modification, avant son enregistrement.
     * Une demande qui ne dit rien du type laisse le groupe tel qu'il est : les écrans antérieurs continuent de fonctionner.
     */
    void configure(OperationGroup group, OperationGroupRequest request, boolean creating) {
        OperationGroup.Kind current = group.getKind() == null ? OperationGroup.Kind.STANDARD : group.getKind();
        OperationGroup.Kind requested = request.getKind() == null ? current : request.getKind();
        // Changement de type sous le verrou du groupe : une création de sous-groupe ou une prise de poste en cours se termine avant, ou attend.
        if (!creating && requested != current) groupRepository.findLockedById(group.getId());
        if (requested == OperationGroup.Kind.STANDARD) {
            if (creating && request.getPresetId() != null) throw new IllegalArgumentException("Un preset ne s’applique qu’à un équipage de vaisseau");
            if (current == OperationGroup.Kind.CREW) {
                if (assignmentRepository.existsByGroupIdAndPositionIdIsNotNull(group.getId())) {
                    throw new IllegalStateException("Des membres occupent encore un poste : retirez-les de leur poste avant de transformer cet équipage en groupe ordinaire.");
                }
                positionRepository.deleteByGroupId(group.getId());
            }
            group.setKind(OperationGroup.Kind.STANDARD);
            group.setCrewPresetId(null);
            group.setShipModelId(null);
            group.setShipModelName(null);
            group.setPositionMode(OperationGroup.PositionMode.SELF);
            return;
        }
        if (!creating && groupRepository.existsByParentId(group.getId())) {
            throw new IllegalArgumentException("Un équipage ne peut pas contenir de sous-groupes");
        }
        OperationCrewPreset preset = creating && request.getPresetId() != null ? activePreset(request.getPresetId()) : null;
        Long modelId = request.getShipModelId() != null ? request.getShipModelId() : preset != null ? preset.getShipModelId() : group.getShipModelId();
        if (preset != null && preset.getShipModelId() != null && !preset.getShipModelId().equals(modelId)) {
            throw new IllegalArgumentException("Ce preset est prévu pour un autre modèle de vaisseau");
        }
        if (modelId != null && (!modelId.equals(group.getShipModelId()) || group.getShipModelName() == null)) {
            Ship ship = shipRepository.findById(modelId).orElseThrow(() -> new IllegalArgumentException("Modèle de vaisseau introuvable dans le catalogue"));
            group.setShipModelId(ship.getId());
            group.setShipModelName(ship.getName());
        } else if (modelId == null && group.getShipModelName() == null) {
            throw new IllegalArgumentException("Choisissez le modèle de vaisseau de cet équipage");
        }
        group.setKind(OperationGroup.Kind.CREW);
        if (request.getPositionMode() != null) group.setPositionMode(request.getPositionMode());
        else if (preset != null) group.setPositionMode(preset.getPositionMode());
        else if (group.getPositionMode() == null) group.setPositionMode(OperationGroup.PositionMode.SELF);
        if (preset != null && request.getCapacity() == null) group.setCapacity(preset.getCapacity());
        // Créé à partir d'un preset : l'équipage suivra ses modifications tant qu'il n'est pas retouché à la main.
        if (preset != null) group.setCrewPresetId(preset.getId());
    }

    /** Postes retouchés à la main : l'équipage garde ses réglages et ne suit plus le preset. */
    private void detachFromPreset(OperationGroup group) {
        if (group.getCrewPresetId() == null) return;
        group.setCrewPresetId(null);
        groupRepository.save(group);
    }

    /** Copie les postes du preset dans l'équipage qui vient d'être créé : le preset n'est plus consulté ensuite. */
    void copyPresetPositions(OperationGroup group, UUID presetId) {
        if (presetId == null || group.getKind() != OperationGroup.Kind.CREW) return;
        List<OperationCrewPresetPosition> source = presetPositionRepository.findByPresetIdOrderBySortOrderAscIdAsc(activePreset(presetId).getId());
        for (OperationCrewPresetPosition position : source) {
            positionRepository.save(OperationGroupPosition.builder().groupId(group.getId()).label(position.getLabel()).icon(position.getIcon())
                    .capacity(position.getCapacity()).sortOrder(position.getSortOrder()).build());
        }
    }

    private OperationCrewPreset activePreset(UUID presetId) {
        return presetRepository.findById(presetId).filter(preset -> !preset.isArchived())
                .orElseThrow(() -> new ResourceNotFoundException("Preset introuvable"));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationCrewDTO.Position>> addPosition(UUID operationId, Long groupId, OperationPositionRequest request) {
        OperationGroup group = crewGroup(operationId, groupId);
        operationLock.requireOpen(operationId);
        groupRepository.findLockedById(groupId);
        List<OperationGroupPosition> existing = positionRepository.findByGroupIdOrderBySortOrderAscIdAsc(groupId);
        if (existing.size() >= MAX_POSITIONS) throw new IllegalArgumentException("Un équipage compte au plus " + MAX_POSITIONS + " postes");
        String label = validate(request, existing.stream().map(OperationGroupPosition::getLabel).toList());
        OperationGroupPosition saved = positionRepository.save(OperationGroupPosition.builder().groupId(group.getId()).label(label)
                .icon(blankToNull(request.getIcon())).capacity(request.getCapacity()).sortOrder(request.getSortOrder()).build());
        detachFromPreset(group);
        operationRepository.markModified(operationId, LocalDateTime.now());
        return messageService.buildResponse("operation.crew.position.saved", toDto(saved, 0));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationCrewDTO.Position>> updatePosition(UUID operationId, Long groupId, Long positionId, OperationPositionRequest request) {
        OperationGroup group = crewGroup(operationId, groupId);
        operationLock.requireOpen(operationId);
        // Même verrou que les prises de poste : la capacité n'est jamais abaissée pendant qu'une place est attribuée.
        groupRepository.findLockedById(groupId);
        OperationGroupPosition position = positionOf(groupId, positionId);
        String label = validate(request, positionRepository.findByGroupIdOrderBySortOrderAscIdAsc(groupId).stream()
                .filter(other -> !other.getId().equals(positionId)).map(OperationGroupPosition::getLabel).toList());
        long taken = assignmentRepository.countByPositionIdAndStatus(positionId, OperationAssignment.Status.CONFIRMED);
        if (request.getCapacity() != null && request.getCapacity() < taken) {
            throw new IllegalArgumentException("La capacité ne peut pas être inférieure au nombre de membres à ce poste : changez d’abord leur poste.");
        }
        position.setLabel(label);
        position.setIcon(blankToNull(request.getIcon()));
        position.setCapacity(request.getCapacity());
        position.setSortOrder(request.getSortOrder());
        detachFromPreset(group);
        operationRepository.markModified(operationId, LocalDateTime.now());
        return messageService.buildResponse("operation.crew.position.saved", toDto(positionRepository.save(position), (int) taken));
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> deletePosition(UUID operationId, Long groupId, Long positionId) {
        OperationGroup group = crewGroup(operationId, groupId);
        operationLock.requireOpen(operationId);
        groupRepository.findLockedById(groupId);
        OperationGroupPosition position = positionOf(groupId, positionId);
        if (assignmentRepository.countByPositionIdAndStatus(positionId, OperationAssignment.Status.CONFIRMED) > 0) {
            throw new IllegalStateException("Ce poste est occupé : changez le poste de ses membres avant de le supprimer.");
        }
        positionRepository.delete(position);
        detachFromPreset(group);
        operationRepository.markModified(operationId, LocalDateTime.now());
        return messageService.buildResponse("operation.crew.position.deleted", null);
    }

    /** Le membre choisit, change ou quitte son propre poste ; positionId null : sans poste. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> setMyPosition(UUID operationId, Long positionId) {
        operationRepository.findById(operationId).filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        operationLock.requireOpen(operationId);
        UUID userId = AuthUtils.getCurrentUserId();
        OperationAssignment assignment = confirmedAssignment(operationId, userId)
                .orElseThrow(() -> new IllegalStateException("Rejoignez d’abord un équipage pour choisir un poste"));
        OperationGroup group = crewGroup(operationId, assignment.getGroupId());
        if (group.getPositionMode() != OperationGroup.PositionMode.SELF) {
            throw new AccessDeniedException("Les postes de cet équipage sont attribués par ses responsables");
        }
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)) {
            throw new IllegalStateException("La participation Présent est requise");
        }
        apply(assignment, group, positionId, true);
        return messageService.buildResponse("operation.crew.position.assigned", null);
    }

    /** Organisateur, ou responsable dans sa délégation : attribue, change ou retire le poste d'un membre de l'équipage. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> setMemberPosition(UUID operationId, UUID userId, Long positionId) {
        visibleOperation(operationId);
        OperationAssignment assignment = confirmedAssignment(operationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Ce membre n’est affecté à aucun équipage"));
        OperationGroup group = crewGroup(operationId, assignment.getGroupId());
        if (!organizer() && !assignmentService.hasResponsibleScope(AuthUtils.getCurrentUserId(), group)) {
            throw new AccessDeniedException("Équipage hors de votre délégation");
        }
        operationLock.requireOpen(operationId);
        apply(assignment, group, positionId, false);
        return messageService.buildResponse("operation.crew.position.assigned", null);
    }

    private java.util.Optional<OperationAssignment> confirmedAssignment(UUID operationId, UUID userId) {
        return assignmentRepository.findByOperationEventIdAndUserId(operationId, userId)
                .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED);
    }

    /**
     * Sous le verrou du groupe, comme les affectations : deux membres qui visent la dernière place d'un poste passent l'un après l'autre.
     * L'écriture ne touche que la colonne du poste et échoue si le membre a changé de groupe entre-temps.
     */
    private void apply(OperationAssignment assignment, OperationGroup group, Long positionId, boolean byMember) {
        groupRepository.findLockedById(group.getId());
        // Sous verrou : les postes ont pu passer entre-temps aux mains des responsables.
        if (byMember && !groupRepository.existsByIdAndPositionMode(group.getId(), OperationGroup.PositionMode.SELF)) {
            throw new AccessDeniedException("Les postes de cet équipage sont attribués par ses responsables");
        }
        if (positionId != null) {
            OperationGroupPosition position = positionRepository.findById(positionId).filter(value -> group.getId().equals(value.getGroupId()))
                    .orElseThrow(() -> new IllegalArgumentException("Ce poste n’appartient pas à cet équipage"));
            if (position.getCapacity() != null && assignmentRepository.countByPositionIdAndStatusAndUserIdNot(
                    positionId, OperationAssignment.Status.CONFIRMED, assignment.getUserId()) >= position.getCapacity()) {
                throw new IllegalStateException("Poste complet");
            }
        }
        if (assignmentRepository.setPosition(assignment.getId(), group.getId(), positionId) != 1) {
            throw new IllegalStateException("L’organisation vient d’être modifiée : réessayez.");
        }
    }

    private OperationGroupPosition positionOf(Long groupId, Long positionId) {
        return positionRepository.findById(positionId).filter(value -> groupId.equals(value.getGroupId()))
                .orElseThrow(() -> new ResourceNotFoundException("Poste introuvable"));
    }

    private static OperationCrewDTO.Position toDto(OperationGroupPosition position, int taken) {
        return new OperationCrewDTO.Position(position.getId(), position.getLabel(), position.getIcon(), position.getCapacity(), taken, position.getSortOrder());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Contrôle un poste d'équipage ou de preset et rend son libellé nettoyé ; `otherLabels` : les libellés déjà pris à côté. */
    static String validate(OperationPositionRequest request, List<String> otherLabels) {
        if (request == null || request.getLabel() == null || request.getLabel().isBlank() || request.getLabel().trim().length() > 80) {
            throw new IllegalArgumentException("Nom de poste invalide");
        }
        String label = request.getLabel().trim();
        if (otherLabels.stream().anyMatch(other -> other != null && other.trim().equalsIgnoreCase(label))) {
            throw new IllegalArgumentException("Un poste porte déjà ce nom dans cet équipage");
        }
        String icon = blankToNull(request.getIcon());
        if (icon != null && !ICON.matcher(icon).matches()) throw new IllegalArgumentException("Icône de poste invalide");
        if (request.getCapacity() != null && (request.getCapacity() < 1 || request.getCapacity() > 1000)) {
            throw new IllegalArgumentException("Capacité de poste invalide");
        }
        if (request.getSortOrder() < 0 || request.getSortOrder() > 10000) throw new IllegalArgumentException("Ordre invalide");
        return label;
    }
}
