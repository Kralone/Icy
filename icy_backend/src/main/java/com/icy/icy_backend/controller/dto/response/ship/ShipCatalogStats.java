package com.icy.icy_backend.controller.dto.response.ship;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Caractéristiques d'un vaisseau lues dans la fiche du catalogue (API Star Citizen Wiki).
 * Chaque valeur absente ou invalide de la source reste null : l'interface ne l'affiche pas.
 * Unités de la source : mètres, kilogrammes, m/s, degrés/s, minutes (assurance).
 */
public record ShipCatalogStats(
        Integer sizeClass,
        String career,
        String role,
        Integer crewMin,
        Integer crewMax,
        Double cargoScu,
        Double length,
        Double width,
        Double height,
        Double mass,
        Double scmSpeed,
        Double maxSpeed,
        Double boostSpeed,
        Double pitch,
        Double yaw,
        Double roll,
        Double hull,
        Double shield,
        Double quantumSpeed,
        Double quantumRange,
        Double hydrogenFuel,
        Double quantumFuel,
        Double pilotDps,
        Integer missiles,
        Double insuranceClaimMinutes,
        Double insuranceExpediteMinutes,
        Double insuranceExpediteCost,
        String description
) {
    public static ShipCatalogStats from(JsonNode payload) {
        if (payload == null || !payload.isObject()) return null;
        JsonNode dimension = payload.path("dimension").isObject() ? payload.path("dimension") : payload.path("sizes");
        JsonNode speed = payload.path("speed");
        JsonNode agility = payload.path("agility");
        JsonNode quantum = payload.path("quantum");
        JsonNode insurance = payload.path("insurance");
        JsonNode crew = payload.path("crew");
        Double mass = positive(payload.path("mass_total"));
        Double shield = positive(payload.path("shield_hp"));
        Double width = positive(dimension.path("width"));
        return new ShipCatalogStats(
                positiveInt(payload.path("size_class")),
                text(payload.path("career")),
                text(payload.path("role")),
                positiveInt(crew.isObject() ? crew.path("min") : payload.path("crew_min")),
                positiveInt(crew.isObject() ? crew.path("max") : payload.path("crew_max")),
                positiveOrZero(payload.path("cargo_capacity")),
                positive(dimension.path("length")),
                width != null ? width : positive(dimension.path("beam")),
                positive(dimension.path("height")),
                mass != null ? mass : positive(payload.path("mass")),
                positive(speed.path("scm")),
                positive(speed.path("max")),
                positive(speed.path("boost_forward")),
                positive(agility.path("pitch")),
                positive(agility.path("yaw")),
                positive(agility.path("roll")),
                positive(payload.path("health")),
                shield != null ? shield : positive(payload.path("shield").path("hp")),
                positive(quantum.path("quantum_speed")),
                positive(quantum.path("quantum_range")),
                positive(payload.path("fuel").path("capacity")),
                positive(quantum.path("quantum_fuel_capacity")),
                positive(payload.path("weaponry").path("pilot_dps")),
                positiveInt(payload.path("weaponry").path("missiles").path("count")),
                positive(insurance.path("claim_time")),
                positive(insurance.path("expedite_time")),
                positive(insurance.path("expedite_cost")),
                localized(payload.path("game_description"))
        );
    }

    private static Double positive(JsonNode node) {
        return node.isNumber() && node.doubleValue() > 0 ? node.doubleValue() : null;
    }

    private static Double positiveOrZero(JsonNode node) {
        return node.isNumber() && node.doubleValue() >= 0 ? node.doubleValue() : null;
    }

    private static Integer positiveInt(JsonNode node) {
        return node.isIntegralNumber() && node.intValue() > 0 ? node.intValue() : null;
    }

    private static String text(JsonNode node) {
        return node.isTextual() && !node.asText().isBlank() ? node.asText().trim() : null;
    }

    /** Description localisée : français si la source le fournit, sinon anglais. */
    private static String localized(JsonNode node) {
        if (node.isTextual()) return text(node);
        if (!node.isObject()) return null;
        for (String key : new String[]{"fr_FR", "fr", "en_EN", "en"}) {
            String value = text(node.path(key));
            if (value != null) return value;
        }
        return null;
    }
}
