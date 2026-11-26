package com.icy.icy_backend.controller.dto.response.front;

/**
 * probability : part des relevés (Regolith) ou chance d'apparition lue dans les fichiers du jeu (Wiki).
 * method, clusterMin, clusterMax et clusterProbability ne viennent que des fichiers du jeu.
 */
public record OreMixDTO(
        String oreCode,
        Double probability,
        Double minPct,
        Double maxPct,
        Double medPct,
        String imageUrl,
        Long catalogEntryId,
        String method,
        Integer clusterMin,
        Integer clusterMax,
        Double clusterProbability
) {
    public OreMixDTO(String oreCode, Double probability, Double minPct, Double maxPct, Double medPct) {
        this(oreCode, probability, minPct, maxPct, medPct, null, null, null, null, null, null);
    }

    public OreMixDTO(String oreCode, Double probability, Double minPct, Double maxPct, Double medPct,
                     String imageUrl, Long catalogEntryId) {
        this(oreCode, probability, minPct, maxPct, medPct, imageUrl, catalogEntryId, null, null, null, null);
    }
}
