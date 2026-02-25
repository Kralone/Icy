package com.icy.icy_backend.controller.dto.request.admin;

import com.icy.icy_backend.db.entity.universe.CelestialBodyType;

public record PlanetUpsertRequest(
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
