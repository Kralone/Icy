package com.icy.icy_backend.controller.dto.response.front;

import com.icy.icy_backend.db.entity.universe.CelestialBodyType;

public record CelestialBodyDTO(
        Long id,
        String name,
        String slug,
        CelestialBodyType bodyType,
        String systemName,
        String parentPlanet,
        String wikiUrl,
        String imageUrl,
        String gameVersion,
        Integer sortOrder
) {
}
