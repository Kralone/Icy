package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationCrewPresetRequest;
import com.icy.icy_backend.controller.dto.operation.OperationPositionRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationCrewPresetDTO;
import com.icy.icy_backend.db.entity.event.OperationCrewPreset;
import com.icy.icy_backend.db.entity.event.OperationCrewPresetPosition;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.repository.event.OperationCrewPresetPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationCrewPresetRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Bibliothèque de presets d'équipage. Les administrateurs l'écrivent, les organisateurs la lisent.
 * Un équipage créé à partir d'un preset le suit : enregistrer le preset met à jour les équipages des opérations à venir
 * qui n'ont pas été retouchés à la main. Les opérations terminées gardent leur équipage ; archiver un preset ne change rien.
 */
@Service
@RequiredArgsConstructor
public class OperationCrewPresetService {
    private final OperationCrewPresetRepository presetRepository;
    private final OperationCrewPresetPositionRepository positionRepository;
    private final ShipRepository shipRepository;
    private final MessageService messageService;

    // Facultatifs : sans eux (tests construits à la main), un preset enregistré ne met aucun équipage à jour.
    private com.icy.icy_backend.db.repository.event.OperationGroupRepository groupRepository;
    private com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository groupPositionRepository;
    private com.icy.icy_backend.db.repository.event.EventRepository eventRepository;
    private com.icy.icy_backend.websocket.OperationLiveUpdateService liveUpdates;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setCrewSync(com.icy.icy_backend.db.repository.event.OperationGroupRepository groups,
                            com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository positions,
                            com.icy.icy_backend.db.repository.event.EventRepository events,
                            com.icy.icy_backend.websocket.OperationLiveUpdateService liveUpdates) {
        this.groupRepository = groups;
        this.groupPositionRepository = positions;
        this.eventRepository = events;
        this.liveUpdates = liveUpdates;
    }

    /** Les presets archivés ne sont rendus qu'à un administrateur qui les demande. */
    @Transactional(readOnly = true)
    public List<OperationCrewPresetDTO> list(Long shipModelId, boolean includeArchived) {
        boolean archivedToo = includeArchived && AuthUtils.isAdmin();
        List<OperationCrewPreset> presets = presetRepository.findAllByOrderByShipModelNameAscNameAsc().stream()
                .filter(preset -> archivedToo || !preset.isArchived())
                .filter(preset -> shipModelId == null || shipModelId.equals(preset.getShipModelId()))
                .toList();
        if (presets.isEmpty()) return List.of();
        Map<UUID, List<OperationCrewPresetPosition>> positions = positionRepository
                .findByPresetIdInOrderBySortOrderAscIdAsc(presets.stream().map(OperationCrewPreset::getId).toList())
                .stream().collect(Collectors.groupingBy(OperationCrewPresetPosition::getPresetId));
        Map<Long, Ship> ships = shipRepository.findAllById(presets.stream().map(OperationCrewPreset::getShipModelId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Ship::getId, Function.identity()));
        return presets.stream().map(preset -> toDto(preset, positions.getOrDefault(preset.getId(), List.of()),
                preset.getShipModelId() == null ? null : ships.get(preset.getShipModelId()))).toList();
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationCrewPresetDTO>> create(OperationCrewPresetRequest request) {
        Ship ship = validate(request);
        OperationCrewPreset preset = presetRepository.save(OperationCrewPreset.builder().name(request.getName().trim()).description(request.getDescription())
                .shipModelId(ship.getId()).shipModelName(ship.getName()).capacity(request.getCapacity())
                .positionMode(request.getPositionMode() == null ? OperationGroup.PositionMode.SELF : request.getPositionMode())
                .createdBy(AuthUtils.getCurrentUserId()).build());
        return messageService.buildResponse("operation.crew.preset.saved", toDto(preset, savePositions(preset.getId(), request.getPositions()), ship));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationCrewPresetDTO>> update(UUID presetId, OperationCrewPresetRequest request) {
        OperationCrewPreset preset = presetRepository.findById(presetId).orElseThrow(() -> new ResourceNotFoundException("Preset introuvable"));
        Ship ship = validate(request);
        preset.setName(request.getName().trim());
        preset.setDescription(request.getDescription());
        preset.setShipModelId(ship.getId());
        preset.setShipModelName(ship.getName());
        preset.setCapacity(request.getCapacity());
        preset.setPositionMode(request.getPositionMode() == null ? OperationGroup.PositionMode.SELF : request.getPositionMode());
        preset.setUpdatedAt(LocalDateTime.now());
        presetRepository.save(preset);
        positionRepository.deleteAllByPresetId(presetId);
        List<OperationCrewPresetPosition> positions = savePositions(presetId, request.getPositions());
        syncLinkedCrews(preset, positions);
        return messageService.buildResponse("operation.crew.preset.saved", toDto(preset, positions, ship));
    }

    /**
     * Répercute le preset sur les équipages qui le suivent, dans les opérations à venir (brouillons compris).
     * Postes rapprochés par leur nom : mis à jour, ajoutés ou supprimés. Les membres d'un poste supprimé restent dans l'équipage,
     * sans poste. Un équipage d'un autre modèle de vaisseau que le preset ne le suit plus.
     */
    private void syncLinkedCrews(OperationCrewPreset preset, List<OperationCrewPresetPosition> positions) {
        if (groupRepository == null || groupPositionRepository == null || eventRepository == null) return;
        LocalDateTime now = LocalDateTime.now(OperationLock.ZONE);
        for (OperationGroup crew : groupRepository.findByCrewPresetId(preset.getId())) {
            boolean upcoming = eventRepository.findById(crew.getOperationEventId())
                    .map(event -> !OperationLock.isClosed(event.getEndDateTime(), now)).orElse(false);
            if (!upcoming) continue;
            if (crew.getKind() != OperationGroup.Kind.CREW || !Objects.equals(crew.getShipModelId(), preset.getShipModelId())) {
                crew.setCrewPresetId(null);
                groupRepository.save(crew);
                continue;
            }
            groupRepository.findLockedById(crew.getId());
            Map<String, com.icy.icy_backend.db.entity.event.OperationGroupPosition> existing = groupPositionRepository
                    .findByGroupIdOrderBySortOrderAscIdAsc(crew.getId()).stream()
                    .collect(Collectors.toMap(position -> position.getLabel().trim().toLowerCase(java.util.Locale.ROOT), Function.identity(), (first, second) -> first));
            java.util.Set<String> wanted = positions.stream().map(position -> position.getLabel().trim().toLowerCase(java.util.Locale.ROOT)).collect(Collectors.toSet());
            // Suppressions d'abord : un nom libéré peut être repris juste après sans heurter l'unicité des noms.
            existing.entrySet().stream().filter(entry -> !wanted.contains(entry.getKey())).map(Map.Entry::getValue).toList()
                    .forEach(groupPositionRepository::delete);
            groupPositionRepository.flush();
            for (OperationCrewPresetPosition source : positions) {
                var target = existing.get(source.getLabel().trim().toLowerCase(java.util.Locale.ROOT));
                if (target == null) {
                    target = com.icy.icy_backend.db.entity.event.OperationGroupPosition.builder().groupId(crew.getId()).build();
                }
                target.setLabel(source.getLabel());
                target.setIcon(source.getIcon());
                target.setCapacity(source.getCapacity());
                target.setSortOrder(source.getSortOrder());
                groupPositionRepository.save(target);
            }
            crew.setCapacity(preset.getCapacity());
            crew.setPositionMode(preset.getPositionMode());
            groupRepository.save(crew);
            if (liveUpdates != null) liveUpdates.changed(crew.getOperationEventId());
        }
    }

    /** Archive ou rétablit un preset : il reste en base et les équipages déjà créés à partir de lui ne changent pas. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> setArchived(UUID presetId, boolean archived) {
        OperationCrewPreset preset = presetRepository.findById(presetId).orElseThrow(() -> new ResourceNotFoundException("Preset introuvable"));
        preset.setArchived(archived);
        preset.setUpdatedAt(LocalDateTime.now());
        presetRepository.save(preset);
        return messageService.buildResponse("operation.crew.preset.archived", null);
    }

    private Ship validate(OperationCrewPresetRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank() || request.getName().trim().length() > 120) {
            throw new IllegalArgumentException("Nom de preset invalide");
        }
        if (request.getDescription() != null && request.getDescription().length() > 2000) throw new IllegalArgumentException("Description trop longue");
        if (request.getCapacity() != null && (request.getCapacity() < 1 || request.getCapacity() > 10000)) throw new IllegalArgumentException("La capacité doit être comprise entre 1 et 10 000 ; laissez-la vide pour ne pas limiter");
        if (request.getShipModelId() == null) throw new IllegalArgumentException("Choisissez le modèle de vaisseau de ce preset");
        List<OperationPositionRequest> positions = request.getPositions() == null ? List.of() : request.getPositions();
        if (positions.size() > OperationCrewService.MAX_POSITIONS) {
            throw new IllegalArgumentException("Un équipage compte au plus " + OperationCrewService.MAX_POSITIONS + " postes");
        }
        List<String> seen = new ArrayList<>();
        for (OperationPositionRequest position : positions) seen.add(OperationCrewService.validate(position, seen));
        return shipRepository.findById(request.getShipModelId()).orElseThrow(() -> new IllegalArgumentException("Modèle de vaisseau introuvable dans le catalogue"));
    }

    /** L'ordre de la liste envoyée devient l'ordre des postes. */
    private List<OperationCrewPresetPosition> savePositions(UUID presetId, List<OperationPositionRequest> positions) {
        List<OperationCrewPresetPosition> saved = new ArrayList<>();
        if (positions == null) return saved;
        for (int index = 0; index < positions.size(); index++) {
            OperationPositionRequest position = positions.get(index);
            String icon = position.getIcon() == null || position.getIcon().isBlank() ? null : position.getIcon().trim();
            saved.add(positionRepository.save(OperationCrewPresetPosition.builder().presetId(presetId).label(position.getLabel().trim())
                    .icon(icon).capacity(position.getCapacity()).sortOrder(index).build()));
        }
        return saved;
    }

    private static OperationCrewPresetDTO toDto(OperationCrewPreset preset, List<OperationCrewPresetPosition> positions, Ship ship) {
        return new OperationCrewPresetDTO(preset.getId(), preset.getName(), preset.getDescription(),
                ship == null ? null : preset.getShipModelId(), ship == null ? preset.getShipModelName() : ship.getName(), ship == null ? null : ship.getImageUrl(),
                preset.getCapacity(), preset.getPositionMode(), preset.isArchived(),
                positions.stream().map(position -> new OperationCrewPresetDTO.Position(position.getLabel(), position.getIcon(), position.getCapacity())).toList());
    }
}
