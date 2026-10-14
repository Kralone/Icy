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
 * Un preset n'est jamais référencé par une opération : le modifier ou l'archiver ne change aucune opération existante.
 */
@Service
@RequiredArgsConstructor
public class OperationCrewPresetService {
    private final OperationCrewPresetRepository presetRepository;
    private final OperationCrewPresetPositionRepository positionRepository;
    private final ShipRepository shipRepository;
    private final MessageService messageService;

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
        return messageService.buildResponse("operation.crew.preset.saved", toDto(preset, savePositions(presetId, request.getPositions()), ship));
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
