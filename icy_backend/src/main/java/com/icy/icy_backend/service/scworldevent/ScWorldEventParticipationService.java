package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.UpsertScWorldEventParticipationDTO;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventParticipationRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScWorldEventParticipationService {

    private final ScWorldEventParticipationRepository repository;
    private final ScWorldEventService scWorldEventService;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    public List<ScWorldEventParticipation> getAllForUser(UUID userId) {
        return repository.findAllByUser_Id(userId);
    }

    public ScWorldEventParticipation getForUserAndEventOrThrow(UUID scweId, UUID userId) {
        return repository.findByScWorldEvent_IdAndUser_Id(scweId, userId)
                .orElseThrow(() -> {
                    log.warn("SCWE participation not found: scweId={}, userId={}", scweId, userId);
                    return new ResourceNotFoundException("Participation introuvable.");
                });
    }

    /**
     * Upsert par userIdentifier (UUID userId ou String discordId)
     */
    public ScWorldEventParticipation upsert(UUID scweId, Object userIdentifier, UpsertScWorldEventParticipationDTO dto) {
        ScWorldEvent event = scWorldEventService.getByIdOrThrow(scweId);
        User user = userService.resolveUser(userIdentifier);

        Map<String, Integer> points = dto.getPoints() == null ? Map.of() : dto.getPoints();

        String schemaJson = scWorldEventService.getSchemaForEvent(event);
        validatePointsAgainstSchema(points, schemaJson);

        int total = computeTotal(points, schemaJson);

        ScWorldEventParticipation p = repository.findByScWorldEvent_IdAndUser_Id(scweId, user.getId())
                .orElseGet(() -> ScWorldEventParticipation.builder()
                        .id(UUID.randomUUID())
                        .scWorldEvent(event)
                        .user(user)
                        .createdAt(Instant.now())
                        .build());

        // DTO status = short, entity souvent Integer -> cast propre
        p.setStatus(dto.getStatus());

        // ✅ JSONB: on stocke un JsonNode (pas une String)
        JsonNode pointsJson = objectMapper.valueToTree(points);
        p.setPoints(pointsJson);

        p.setTotal(total);
        p.setUpdatedAt(Instant.now());

        return repository.save(p);
    }

    private void validatePointsAgainstSchema(Map<String, Integer> points, String schemaJson) {
        JsonNode schema = readJson(schemaJson);
        JsonNode fields = schema.get("fields");
        if (fields == null || !fields.isArray()) {
            // No constraints => accept any keys
            return;
        }

        Map<String, JsonNode> allowed = new HashMap<>();
        for (JsonNode f : fields) {
            JsonNode keyNode = f.get("key");
            if (keyNode != null && keyNode.isTextual()) {
                allowed.put(keyNode.asText(), f);
            }
        }

        for (var entry : points.entrySet()) {
            String key = entry.getKey();
            Integer value = entry.getValue();
            JsonNode field = allowed.get(key);
            if (field == null) {
                throw new IllegalArgumentException("Clé de points invalide : " + key);
            }

            int v = value == null ? 0 : value;

            JsonNode min = field.get("min");
            if (min != null && min.isNumber() && v < min.asInt()) {
                throw new IllegalArgumentException("Valeur trop petite pour : " + key);
            }

            JsonNode max = field.get("max");
            if (max != null && max.isNumber() && v > max.asInt()) {
                throw new IllegalArgumentException("Valeur trop grande pour : " + key);
            }
        }
    }

    private int computeTotal(Map<String, Integer> points, String schemaJson) {
        JsonNode schema = readJson(schemaJson);
        JsonNode totalNode = schema.get("total");
        if (totalNode != null && totalNode.isObject()) {
            JsonNode mode = totalNode.get("mode");
            if (mode != null && mode.isTextual() && "sum".equalsIgnoreCase(mode.asText())) {
                JsonNode keys = totalNode.get("keys");
                if (keys != null && keys.isArray()) {
                    int sum = 0;
                    for (JsonNode k : keys) {
                        if (k.isTextual()) {
                            Integer v = points.get(k.asText());
                            sum += (v == null ? 0 : v);
                        }
                    }
                    return sum;
                }
            }
        }
        // Default: sum all values
        return points.values().stream().mapToInt(v -> v == null ? 0 : v).sum();
    }

    private JsonNode readJson(String json) {
        try {
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (Exception e) {
            throw new IllegalArgumentException("Schema JSON invalide.");
        }
    }

    public Page<ScWorldEventParticipation> getLeaderboard(UUID eventId, int page, int size) {
        return repository.findLeaderboard(eventId, PageRequest.of(page, size));
    }
}
