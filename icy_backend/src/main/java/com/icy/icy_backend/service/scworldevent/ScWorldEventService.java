package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventDTO;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScWorldEventService {

    private final ScWorldEventRepository repository;
    private final ScWorldEventTypeService typeService;
    private final ObjectMapper objectMapper;

    // =========================================================================
    // LECTURE
    // =========================================================================

    public ScWorldEvent getByIdOrThrow(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> {
                    log.warn("SCWorldEvent not found: {}", id);
                    return new ResourceNotFoundException("SC World Event introuvable : " + id);
                });
    }

    /**
     * ✅ POUR L'ADMIN : Récupère TOUT l'historique.
     * Trié par date de début décroissante (le plus récent en premier).
     */
    public Page<ScWorldEvent> getAll(int page, int size) {
        return repository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startAt"))
        );
    }

    public Page<ScWorldEvent> getHistory(int page, int size) {
        return repository.findPast(
                Instant.now(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "endAt"))
        );
    }

    /**
     * ✅ POUR LE JOUEUR : Récupère les événements "JOUABLES".
     * C'est-à-dire : Ceux qui ne sont PAS finis (Date de fin future ou nulle).
     * Trié par date de début croissante (le plus proche en premier).
     */
    public Page<ScWorldEvent> getPlayable(int page, int size) {
        return repository.findActiveOrFuture(
                Instant.now(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startAt"))
        );
    }

    public Optional<ScWorldEvent> getCurrentOptional() {
        return repository.findCurrent(Instant.now());
    }

    public boolean hasCurrentEvent() {
        return repository.existsCurrent(Instant.now());
    }

    public String getSchemaForEvent(ScWorldEvent e) {
        // On délègue directement au Type (Source de vérité)
        return e.getType().getScoreSchema();
    }

    // =========================================================================
    // ÉCRITURE
    // =========================================================================

    public ScWorldEvent create(CreateScWorldEventDTO dto) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new IllegalArgumentException("Le titre est requis.");
        }
        if (dto.getStartAt() == null) {
            throw new IllegalArgumentException("startAt est requis.");
        }
        if (dto.getTypeName() == null || dto.getTypeName().isBlank()) {
            throw new IllegalArgumentException("typeName est requis.");
        }

        // 1. Récupération du Type
        ScWorldEventType type = typeService.getByNameOrThrow(dto.getTypeName());

        // 2. Gestion de la Galerie
        String gallery = normalizeJson(dto.getGallery(), "[]");
        parseJsonOrThrow(gallery, "gallery");

        ScWorldEvent e = ScWorldEvent.builder()
                .id(UUID.randomUUID())
                .title(dto.getTitle())
                .description(dto.getDescription())
                .startAt(dto.getStartAt())
                .endAt(dto.getEndAt())
                .type(type)
                .bannerImageUrl(dto.getBannerImageUrl())
                .gallery(gallery)
                .createdAt(Instant.now())
                .build();

        return repository.save(e);
    }

    public ScWorldEvent update(UUID id, UpdateScWorldEventDTO dto) {
        ScWorldEvent e = getByIdOrThrow(id);

        if (dto.getTitle() != null && !dto.getTitle().isBlank()) e.setTitle(dto.getTitle());
        if (dto.getDescription() != null) e.setDescription(dto.getDescription());
        if (dto.getStartAt() != null) e.setStartAt(dto.getStartAt());
        e.setEndAt(dto.getEndAt());
        if (dto.getBannerImageUrl() != null) e.setBannerImageUrl(dto.getBannerImageUrl());

        if (dto.getTypeName() != null && !dto.getTypeName().isBlank()) {
            ScWorldEventType type = typeService.getByNameOrThrow(dto.getTypeName());
            e.setType(type);
        }

        if (dto.getGallery() != null) {
            String gallery = normalizeJson(dto.getGallery(), "[]");
            parseJsonOrThrow(gallery, "gallery");
            e.setGallery(gallery);
        }

        return repository.save(e);
    }

    public void delete(UUID id) {
        ScWorldEvent e = getByIdOrThrow(id);
        repository.delete(e);
    }

    // =========================================================================
    // UTILITAIRES
    // =========================================================================

    private void parseJsonOrThrow(String json, String fieldName) {
        try {
            objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalArgumentException("JSON invalide pour " + fieldName);
        }
    }

    private String normalizeJson(String json, String fallback) {
        if (json == null) return fallback;
        String s = json.trim();
        return s.isEmpty() ? fallback : s;
    }
}

