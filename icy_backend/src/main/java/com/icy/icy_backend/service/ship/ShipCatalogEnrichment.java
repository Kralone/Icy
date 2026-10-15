package com.icy.icy_backend.service.ship;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.ship.Ship;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/** Reads the exact catalog variant, never the standard ship's equipment. */
@Service
public class ShipCatalogEnrichment {
    private static final Set<String> COMPONENT_TYPES = Set.of(
            "Cooler", "PowerPlant", "QuantumDrive", "Shield", "Radar", "JumpDrive", "LifeSupportGenerator");
    private static final Set<String> WEAPON_TYPES = Set.of(
            "WeaponGun", "Missile", "MissileLauncher", "WeaponDefensive", "Turret", "WeaponMining", "SalvageHead");
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ShipCatalogEnrichment(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void enrich(List<Ship> ships) {
        Map<Long, List<Ship>> byId = new HashMap<>();
        for (Ship ship : ships) {
            if (ship.getId() != null) byId.computeIfAbsent(ship.getId(), ignored -> new ArrayList<>()).add(ship);
        }
        if (byId.isEmpty()) return;
        jdbc.query("""
                SELECT id, family, catalog_group, source_url, source_version, source_updated_at, last_seen_at, image_override_url,
                       source_payload::text
                FROM catalog.entries WHERE id IN (:ids)
                """, Map.of("ids", byId.keySet()), rs -> {
            JsonNode payload;
            try {
                payload = mapper.readTree(rs.getString("source_payload"));
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("Équipement catalogue invalide pour " + rs.getLong("id"), exception);
            }
            for (Ship ship : byId.get(rs.getLong("id"))) {
                ship.setCatalogGroup(rs.getString("catalog_group"));
                ship.setSourceUrl(rs.getString("source_url"));
                ship.setSourceVersion(rs.getString("source_version"));
                ship.setSourceUpdatedAt(rs.getObject("source_updated_at", java.time.OffsetDateTime.class));
                ship.setCatalogFetchedAt(rs.getObject("last_seen_at", java.time.OffsetDateTime.class));
                applyPayload(ship, payload);
                // La classe de taille d'un véhicule terrestre ne suit pas celle des vaisseaux : elle n'est pas transmise.
                ship.setSizeClass("SHIP".equals(rs.getString("family")) ? sizeClass(payload) : null);
                if (rs.getString("image_override_url") != null) ship.setImageIsBase(false);
            }
        });
    }

    public static void applyPayload(Ship ship, JsonNode payload) {
        ship.setExternalId(payload == null ? null : text(payload.path("uuid")));
        ship.setImageIsBase(payload != null && payload.path("image_source_vehicle_uuid").isTextual()
                && !payload.path("image_source_vehicle_uuid").asText().isBlank()
                && !payload.path("image_source_vehicle_uuid").asText().equals(payload.path("uuid").asText()));
        ship.setExecutiveHangar(payload != null && payload.path("executive_hangar").isBoolean()
                ? payload.path("executive_hangar").booleanValue() : null);
        Map<String, Ship.LoadoutItem> components = new LinkedHashMap<>();
        Map<String, Ship.LoadoutItem> weapons = new LinkedHashMap<>();
        if (payload != null) visitPorts(payload.path("ports"), components, weapons);
        ship.setComponents(List.copyOf(components.values()));
        ship.setWeapons(List.copyOf(weapons.values()));
    }

    private static void visitPorts(JsonNode ports, Map<String, Ship.LoadoutItem> components,
                                   Map<String, Ship.LoadoutItem> weapons) {
        if (!ports.isArray()) return;
        for (JsonNode port : ports) {
            JsonNode item = port.path("equipped_item");
            String type = item.path("type").asText("");
            String name = item.path("name").asText("").trim();
            Map<String, Ship.LoadoutItem> target = COMPONENT_TYPES.contains(type) ? components
                    : WEAPON_TYPES.contains(type) ? weapons : null;
            if (target != null && !name.isEmpty() && !name.contains("PLACEHOLDER")) {
                String key = item.path("uuid").asText("");
                if (key.isBlank()) key = type + ":" + name;
                Ship.LoadoutItem previous = target.get(key);
                target.put(key, new Ship.LoadoutItem(name, previous == null ? 1 : previous.quantity() + 1,
                        text(item.path("image_url")), text(item.path("manufacturer").path("name"))));
            }
            // Weapons can be nested beneath gimbals and turrets, even when their mount is not displayed.
            visitPorts(port.path("ports"), components, weapons);
        }
    }

    static Integer sizeClass(JsonNode payload) {
        JsonNode value = payload == null ? null : payload.path("size_class");
        return value != null && value.canConvertToInt() && value.isIntegralNumber() && value.intValue() > 0 ? value.intValue() : null;
    }

    private static String text(JsonNode node) {
        return node.isTextual() && !node.asText().isBlank() ? node.asText() : null;
    }
}
