package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventTypeDTO;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventTypeRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScWorldEventTypeService {

    private final ScWorldEventTypeRepository repository;
    private final ObjectMapper objectMapper;

    public ScWorldEventType getByNameOrThrow(String name) {
        return repository.findById(name)
                .orElseThrow(() -> {
                    log.warn("SCWorldEventType not found: {}", name);
                    return new ResourceNotFoundException("Type SC World Event introuvable : " + name);
                });
    }

    public List<ScWorldEventType> getAll() {
        return repository.findAll();
    }

    public ScWorldEventType create(CreateScWorldEventTypeDTO dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Le nom du type est requis.");
        }

        // Validate schema JSON early
        String schema = normalizeJson(dto.getScoreSchema(), "{}");
        parseJsonOrThrow(schema, "scoreSchema");

        ScWorldEventType t = ScWorldEventType.builder()
                .name(dto.getName())
                .textColor(dto.getTextColor())
                .imageUrl(dto.getImageUrl())
                .scoreSchema(schema)
                .createdAt(Instant.now())
                .build();

        return repository.save(t);
    }

    public ScWorldEventType update(String name, UpdateScWorldEventTypeDTO dto) {
        ScWorldEventType t = getByNameOrThrow(name);

        if (dto.getScoreSchema() != null) {
            String schema = normalizeJson(dto.getScoreSchema(), "{}");
            parseJsonOrThrow(schema, "scoreSchema");
            t.setScoreSchema(schema);
        }
        if (dto.getTextColor() != null) t.setTextColor(dto.getTextColor());
        if (dto.getImageUrl() != null) t.setImageUrl(dto.getImageUrl());

        return repository.save(t);
    }

    public void delete(String name) {
        ScWorldEventType t = getByNameOrThrow(name);
        repository.delete(t);
    }

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
