package com.icy.icy_backend.service.universe;

import com.icy.icy_backend.controller.dto.request.admin.StationUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.OrbitalStationDTO;
import com.icy.icy_backend.db.entity.universe.OrbitalStation;
import com.icy.icy_backend.db.entity.universe.StationKind;
import com.icy.icy_backend.db.entity.universe.StationOrbitKind;
import com.icy.icy_backend.db.repository.universe.OrbitalStationRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
public class OrbitalStationService {
    private final OrbitalStationRepository orbitalStationRepository;
    private final MessageService messageService;

    public OrbitalStationService(OrbitalStationRepository orbitalStationRepository, MessageService messageService) {
        this.orbitalStationRepository = orbitalStationRepository;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OrbitalStationDTO>>> listFrontStations() {
        List<OrbitalStationDTO> rows = orbitalStationRepository.findAllByOrderBySystemNameAscSortOrderAscNameAsc()
                .stream()
                .map(this::toDto)
                .toList();
        return messageService.buildResponse("station.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OrbitalStationDTO>>> listAdminStations() {
        return listFrontStations();
    }

    @Transactional
    public ResponseEntity<MessageResponse<OrbitalStationDTO>> createStation(StationUpsertRequest request) {
        StationPayload payload = sanitize(request);
        OrbitalStation station = new OrbitalStation();
        applyPayload(station, payload);
        OrbitalStation saved = orbitalStationRepository.save(station);
        return messageService.buildResponse("station.created", toDto(saved), saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<OrbitalStationDTO>> updateStation(Long id, StationUpsertRequest request) {
        OrbitalStation existing = orbitalStationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station introuvable avec l'id " + id));
        StationPayload payload = sanitize(request);
        applyPayload(existing, payload);
        OrbitalStation saved = orbitalStationRepository.save(existing);
        return messageService.buildResponse("station.updated", toDto(saved), saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<String>> deleteStation(Long id) {
        OrbitalStation existing = orbitalStationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station introuvable avec l'id " + id));
        String name = existing.getName();
        orbitalStationRepository.delete(existing);
        return messageService.buildResponse("station.deleted", name, name);
    }

    private void applyPayload(OrbitalStation station, StationPayload payload) {
        station.setName(payload.name());
        station.setSlug(toSlug(payload.name()));
        station.setSystemName(payload.systemName());
        station.setStationKind(payload.stationKind());
        station.setOrbitKind(payload.orbitKind());
        station.setOrbitTarget(payload.orbitTarget());
        station.setLagrangePoint(payload.lagrangePoint());
        station.setOperatorName(payload.operatorName());
        station.setWikiUrl(payload.wikiUrl());
        station.setImageUrl(payload.imageUrl());
        station.setGameVersion(payload.gameVersion());
        station.setNotes(payload.notes());
        station.setSortOrder(payload.sortOrder());
    }

    private StationPayload sanitize(StationUpsertRequest request) {
        if (request == null) {
            throw new BadRequestException("Payload station manquant.");
        }

        String name = trimToNull(request.name());
        String systemName = trimToNull(request.systemName());
        String orbitTarget = trimToNull(request.orbitTarget());
        String lagrangePoint = trimToNull(request.lagrangePoint());
        String operatorName = trimToNull(request.operatorName());
        String wikiUrl = trimToNull(request.wikiUrl());
        String imageUrl = trimToNull(request.imageUrl());
        String gameVersion = trimToNull(request.gameVersion());
        String notes = trimToNull(request.notes());
        Integer sortOrder = request.sortOrder();
        StationKind stationKind = request.stationKind() == null ? StationKind.ORBITAL : request.stationKind();
        StationOrbitKind orbitKind = request.orbitKind() == null ? StationOrbitKind.UNKNOWN : request.orbitKind();

        if (name == null || systemName == null || wikiUrl == null || imageUrl == null) {
            throw new BadRequestException("Les champs name, systemName, wikiUrl et imageUrl sont requis.");
        }
        if (gameVersion == null) {
            gameVersion = "4.6";
        }
        if (sortOrder == null) {
            sortOrder = 0;
        }

        return new StationPayload(
                name, systemName, stationKind, orbitKind, orbitTarget, lagrangePoint,
                operatorName, wikiUrl, imageUrl, gameVersion, notes, sortOrder
        );
    }

    private OrbitalStationDTO toDto(OrbitalStation station) {
        return new OrbitalStationDTO(
                station.getId(),
                station.getName(),
                station.getSlug(),
                station.getSystemName(),
                station.getStationKind(),
                station.getOrbitKind(),
                station.getOrbitTarget(),
                station.getLagrangePoint(),
                station.getOperatorName(),
                station.getWikiUrl(),
                station.getImageUrl(),
                station.getGameVersion(),
                station.getNotes(),
                station.getSortOrder()
        );
    }

    private String toSlug(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (normalized.isBlank()) {
            throw new BadRequestException("Impossible de generer un slug station valide.");
        }
        return normalized;
    }

    private String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record StationPayload(
            String name,
            String systemName,
            StationKind stationKind,
            StationOrbitKind orbitKind,
            String orbitTarget,
            String lagrangePoint,
            String operatorName,
            String wikiUrl,
            String imageUrl,
            String gameVersion,
            String notes,
            Integer sortOrder
    ) {
    }
}
