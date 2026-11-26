package com.icy.icy_backend.controller.dto.response.front;

/**
 * Minerai d'une zone, lu dans les fichiers du jeu (Star Citizen Wiki) : chance d'apparition,
 * concentration min et max, mode de minage et taille des amas.
 */
public record OreMixDTO(
        String oreCode,
        Double probability,
        Double minPct,
        Double maxPct,
        String imageUrl,
        Long catalogEntryId,
        String method,
        Integer clusterMin,
        Integer clusterMax,
        Double clusterProbability
) {
}
