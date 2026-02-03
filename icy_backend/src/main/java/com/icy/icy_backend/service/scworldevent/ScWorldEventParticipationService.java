package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.UpsertScWorldEventParticipationDTO;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventParticipationRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.ScWorldEventPublisher;
import com.icy.icy_backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ScWorldEventPublisher scWorldEventPublisher;

    public List<ScWorldEventParticipation> getAllForUser(UUID userId) {
        return repository.findAllByUser_Id(userId);
    }

    public ScWorldEventParticipation getForUserAndEventOrThrow(UUID scweId, UUID userId) {
        return repository.findByScWorldEvent_IdAndUser_Id(scweId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Participation introuvable."));
    }

    @Transactional
    public ScWorldEventParticipation upsert(UUID scweId, Object userIdentifier, UpsertScWorldEventParticipationDTO dto) {
        ScWorldEvent event = scWorldEventService.getByIdOrThrow(scweId);
        User user = userService.resolveUser(userIdentifier);

        // 1. Récupération de l'ancien état (pour comparaison des paliers)
        Optional<ScWorldEventParticipation> existingOpt = repository.findByScWorldEvent_IdAndUser_Id(scweId, user.getId());

        int oldTotal = existingOpt.map(ScWorldEventParticipation::getTotal).orElse(0);
        JsonNode oldPointsNode = existingOpt.map(ScWorldEventParticipation::getPoints).orElse(objectMapper.createObjectNode());

        // 2. Calcul des nouveaux points
        Map<String, Integer> newPointsMap = dto.getPoints() == null ? Map.of() : dto.getPoints();

        // On récupère le schéma depuis le Type de l'event
        // (Assure-toi que ScWorldEventType a bien getScoreSchema())
        String schemaJson = event.getType().getScoreSchema();

        validatePointsAgainstSchema(newPointsMap, schemaJson);
        int newTotal = computeTotal(newPointsMap, schemaJson);

        // 3. Sauvegarde
        ScWorldEventParticipation p = existingOpt.orElseGet(() -> ScWorldEventParticipation.builder()
                .id(UUID.randomUUID())
                .scWorldEvent(event)
                .user(user)
                .createdAt(Instant.now())
                .build());

        p.setStatus(dto.getStatus());
        p.setPoints(objectMapper.valueToTree(newPointsMap));
        p.setTotal(newTotal);
        p.setUpdatedAt(Instant.now());

        ScWorldEventParticipation saved = repository.save(p);

        // 4. Vérification des paliers (Global + Par catégorie)
        checkAndNotifyMilestones(event, user, oldTotal, newTotal, oldPointsNode, newPointsMap, schemaJson);

        return saved;
    }

    /**
     * Vérifie les paliers globaux (Total) et les paliers par champ (Ex: Combat, Transport).
     */
    private void checkAndNotifyMilestones(ScWorldEvent event, User user,
                                          int oldTotal, int newTotal,
                                          JsonNode oldPointsNode, Map<String, Integer> newPointsMap,
                                          String schemaJson) {
        try {
            JsonNode root = readJson(schemaJson);

            // A. Vérification des paliers GLOBAUX (Total)
            // JSON: "total": { "milestones": [...] }
            JsonNode totalMilestones = root.path("total").path("milestones");
            processMilestones(event, user, totalMilestones, oldTotal, newTotal, "Global");

            // B. Vérification des paliers PAR CHAMP (Fields)
            // JSON: "fields": [ { "key": "...", "milestones": [...] } ]
            JsonNode fieldsNode = root.path("fields");
            if (fieldsNode.isArray()) {
                for (JsonNode fieldDef : fieldsNode) {
                    String key = fieldDef.path("key").asText();
                    String label = fieldDef.path("label").asText(key); // Ex: "Combat"
                    JsonNode milestones = fieldDef.path("milestones");

                    // Récupérer ancienne et nouvelle valeur pour ce champ précis
                    int oldVal = oldPointsNode.path(key).asInt(0);
                    int newVal = newPointsMap.getOrDefault(key, 0);

                    processMilestones(event, user, milestones, oldVal, newVal, label);
                }
            }

        } catch (Exception e) {
            log.error("⚠️ Erreur lors du calcul des paliers SCWE pour user {} : {}", user.getId(), e.getMessage());
        }
    }

    /**
     * Logique générique pour traverser une liste de milestones et trigger si franchissement.
     */
    private void processMilestones(ScWorldEvent event, User user, JsonNode milestonesNode, int oldVal, int newVal, String categoryName) {
        if (newVal <= oldVal || milestonesNode.isMissingNode() || !milestonesNode.isArray()) return;

        for (JsonNode ms : milestonesNode) {
            int threshold = ms.path("at").asInt(Integer.MAX_VALUE);

            if (oldVal < threshold && newVal >= threshold) {

                String milestoneLabel = ms.path("label").asText("Nouveau palier !");
                String imageUrl = ms.path("imageUrl").asText("");

                // Si pas de champ "rewards", on envoie null
                String rewardText = ms.has("reward") ? ms.get("reward").asText() : null;

                // On passe rewardText au publisher
                scWorldEventPublisher.publishTierPassed(event, user, milestoneLabel, categoryName, imageUrl, rewardText);
            }
        }
    }

    // --- Validation & Calculs ---

    private void validatePointsAgainstSchema(Map<String, Integer> points, String schemaJson) {
        JsonNode schema = readJson(schemaJson);
        JsonNode fields = schema.get("fields");
        if (fields == null || !fields.isArray()) return;

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
            if (field == null) throw new IllegalArgumentException("Clé de points invalide : " + key);

            int v = value == null ? 0 : value;
            JsonNode min = field.get("min");
            if (min != null && min.isNumber() && v < min.asInt()) throw new IllegalArgumentException("Valeur trop petite pour : " + key);
            JsonNode max = field.get("max");
            if (max != null && max.isNumber() && v > max.asInt()) throw new IllegalArgumentException("Valeur trop grande pour : " + key);
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