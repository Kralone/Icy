package com.icy.icy_backend.controller.dto.response.front;

import com.icy.icy_backend.db.entity.universe.StationKind;
import com.icy.icy_backend.db.entity.universe.StationOrbitKind;

public record OrbitalStationDTO(
        Long id,
        String name,
        String slug,
        String systemName,
        StationKind stationKind,
        StationOrbitKind orbitKind,
        String orbitTarget,
        String lagrangePoint,
        String operatorName,
        String wikiUrl,
        String imageUrl,
        String gameVersion,
        String notes,
        Integer sortOrder
) {
}
