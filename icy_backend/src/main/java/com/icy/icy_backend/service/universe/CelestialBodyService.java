package com.icy.icy_backend.service.universe;

import com.icy.icy_backend.controller.dto.request.admin.PlanetUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.CelestialBodyDTO;
import com.icy.icy_backend.db.entity.universe.CelestialBody;
import com.icy.icy_backend.db.entity.universe.CelestialBodyType;
import com.icy.icy_backend.db.repository.universe.CelestialBodyRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class CelestialBodyService {
    private final CelestialBodyRepository celestialBodyRepository;
    private final MessageService messageService;

    public CelestialBodyService(CelestialBodyRepository celestialBodyRepository, MessageService messageService) {
        this.celestialBodyRepository = celestialBodyRepository;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<CelestialBodyDTO>>> listFrontBodies() {
        List<CelestialBodyDTO> rows = celestialBodyRepository.findAllByOrderBySystemNameAscBodyTypeAscSortOrderAscNameAsc()
                .stream()
                .map(this::toDto)
                .toList();
        return messageService.buildResponse("celestial.body.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<CelestialBodyDTO>>> listAdminBodies() {
        List<CelestialBodyDTO> rows = celestialBodyRepository
                .findAllByOrderBySystemNameAscBodyTypeAscSortOrderAscNameAsc()
                .stream()
                .map(this::toDto)
                .toList();
        return messageService.buildResponse("celestial.body.list", rows, rows.size());
    }

    @Transactional
    public ResponseEntity<MessageResponse<CelestialBodyDTO>> createBody(PlanetUpsertRequest request) {
        BodyPayload payload = sanitizePayload(request);
        if (celestialBodyRepository.existsByNameIgnoreCaseAndBodyType(payload.name(), payload.bodyType())) {
            throw new BadRequestException("Un corps celeste du meme type avec ce nom existe deja.");
        }

        CelestialBody body = new CelestialBody();
        body.setName(payload.name());
        body.setSlug(toSlug(payload.name()));
        body.setBodyType(payload.bodyType());
        body.setSystemName(payload.systemName());
        body.setParentPlanet(payload.parentPlanet());
        body.setWikiUrl(payload.wikiUrl());
        body.setImageUrl(payload.imageUrl());
        body.setGameVersion(payload.gameVersion());
        body.setSortOrder(payload.sortOrder());

        CelestialBody saved = celestialBodyRepository.save(body);
        return messageService.buildResponse("celestial.body.created", toDto(saved), saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<CelestialBodyDTO>> updateBody(Long id, PlanetUpsertRequest request) {
        CelestialBody existing = celestialBodyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Corps celeste introuvable avec l'id " + id));

        BodyPayload payload = sanitizePayload(request);
        if (celestialBodyRepository.existsByNameIgnoreCaseAndBodyTypeAndIdNot(payload.name(), payload.bodyType(), id)) {
            throw new BadRequestException("Un autre corps celeste du meme type avec ce nom existe deja.");
        }

        existing.setName(payload.name());
        existing.setSlug(toSlug(payload.name()));
        existing.setBodyType(payload.bodyType());
        existing.setSystemName(payload.systemName());
        existing.setParentPlanet(payload.parentPlanet());
        existing.setWikiUrl(payload.wikiUrl());
        existing.setImageUrl(payload.imageUrl());
        existing.setGameVersion(payload.gameVersion());
        existing.setSortOrder(payload.sortOrder());

        CelestialBody saved = celestialBodyRepository.save(existing);
        return messageService.buildResponse("celestial.body.updated", toDto(saved), saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<String>> deleteBody(Long id) {
        CelestialBody existing = celestialBodyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Corps celeste introuvable avec l'id " + id));

        String name = existing.getName();
        celestialBodyRepository.delete(existing);
        return messageService.buildResponse("celestial.body.deleted", name, name);
    }

    private CelestialBodyDTO toDto(CelestialBody body) {
        return new CelestialBodyDTO(
                body.getId(),
                body.getName(),
                body.getSlug(),
                body.getBodyType(),
                body.getSystemName(),
                body.getParentPlanet(),
                body.getWikiUrl(),
                body.getImageUrl(),
                body.getGameVersion(),
                body.getSortOrder()
        );
    }

    private BodyPayload sanitizePayload(PlanetUpsertRequest request) {
        if (request == null) {
            throw new BadRequestException("Payload manquant.");
        }

        String name = trimToNull(request.name());
        CelestialBodyType bodyType;
        String systemName = trimToNull(request.systemName());
        String parentPlanet = trimToNull(request.parentPlanet());
        String imageUrl = trimToNull(request.imageUrl());
        String wikiUrl = trimToNull(request.wikiUrl());
        String gameVersion = trimToNull(request.gameVersion());
        Integer sortOrder = request.sortOrder();

        if (name == null || systemName == null || imageUrl == null || wikiUrl == null) {
            throw new BadRequestException("Les champs name, systemName, imageUrl et wikiUrl sont requis.");
        }
        // Regle metier: parent renseigne => lune, sinon planete.
        bodyType = parentPlanet == null ? CelestialBodyType.PLANET : CelestialBodyType.MOON;
        if (bodyType == CelestialBodyType.MOON) {
            validateMoonParent(systemName, parentPlanet);
        }

        if (gameVersion == null) {
            gameVersion = "4.6";
        }
        if (sortOrder == null) {
            sortOrder = 0;
        }

        return new BodyPayload(name, bodyType, systemName, parentPlanet, imageUrl, wikiUrl, gameVersion, sortOrder);
    }

    private void validateMoonParent(String systemName, String parentPlanet) {
        List<CelestialBody> planets = celestialBodyRepository.findAllByBodyTypeOrderBySystemNameAscSortOrderAscNameAsc(CelestialBodyType.PLANET);
        boolean hasParentInSystem = planets.stream()
                .anyMatch(planet ->
                        Objects.equals(systemName, planet.getSystemName())
                                && parentPlanet.equalsIgnoreCase(planet.getName())
                );
        if (!hasParentInSystem) {
            throw new BadRequestException("La planete parente doit exister dans le meme systeme.");
        }
    }

    private String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String toSlug(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (normalized.isBlank()) {
            throw new BadRequestException("Impossible de generer un slug valide pour ce nom.");
        }
        return normalized;
    }

    private record BodyPayload(
            String name,
            CelestialBodyType bodyType,
            String systemName,
            String parentPlanet,
            String imageUrl,
            String wikiUrl,
            String gameVersion,
            Integer sortOrder
    ) {
    }
}
