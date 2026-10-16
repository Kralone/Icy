package com.icy.icy_backend.controller.dto.session;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Estimations de vente pour le reste à vendre : jamais des montants officiels.
 * demandScu null : la source ne donne pas la demande ; l'estimation n'est alors pas plafonnée.
 */
public record SaleSuggestionDTO(List<Commodity> commodities, Stop singleStop, OffsetDateTime pricesFetchedAt) {
    public record Point(Integer terminalId, String terminalName, String location, int pricePerScu, Integer demandScu,
                        long estimatedAuec, OffsetDateTime observedAt) {
    }

    public record Commodity(int commodityId, String commodityName, long remainingCscu, List<Point> points) {
    }

    /** Terminal qui achète le plus de minerais restants à la fois : un repère, pas un itinéraire calculé. */
    public record Stop(Integer terminalId, String terminalName, String location, List<String> commodityNames) {
    }
}
