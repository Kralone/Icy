package com.icy.icy_backend.controller.dto.response.front;

import java.time.OffsetDateTime;
import java.util.List;

/** Zone de minage tirée des fichiers du jeu (Star Citizen Wiki). */
public record OreLocationDTO(
        String locationCode,
        String sourceUrl,
        String gameVersion,
        OffsetDateTime updatedAt,
        List<OreMixDTO> ores,
        String locationKey,
        String systemName
) {
}
