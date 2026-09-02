package com.icy.icy_backend.controller.dto.response.scworldevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
// Assure-toi d'importer ton ScWorldEventDTO (adapte le package si besoin)
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventDTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScWorldEventParticipationDTO {

    private UUID id;

    private ScWorldEventDTO event;

    private UUID userId;
    private String username;
    private String avatarUrl;

    private int status;

    /**
     * JSONB points (map key->value) renvoyé tel quel
     */
    private Map<String, Integer> points;

    private int total;
    private Instant updatedAt;

    public static ScWorldEventParticipationDTO from(ScWorldEventParticipation p) {
        if (p == null) return null;

        return ScWorldEventParticipationDTO.builder()
                .id(p.getId())
                .event(ScWorldEventDTO.from(p.getScWorldEvent()))

                .userId(p.getUser() != null ? p.getUser().getId() : null)
                .username(p.getUser() != null ? p.getUser().getUsername() : "Joueur Inconnu")
                .avatarUrl(p.getUser() != null ? p.getUser().getAvatarUrl() : null)
                .status(p.getStatus())
                .points(toPointMap(p.getPoints()))
                .total(p.getTotal())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    private static Map<String, Integer> toPointMap(JsonNode points) {
        Map<String, Integer> result = new LinkedHashMap<>();
        if (points == null || !points.isObject()) return result;

        points.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value != null && value.isNumber()) {
                result.put(entry.getKey(), value.asInt());
            }
        });
        return result;
    }
}

