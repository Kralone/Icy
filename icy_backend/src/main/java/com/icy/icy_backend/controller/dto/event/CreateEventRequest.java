package com.icy.icy_backend.controller.dto.event;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateEventRequest {
    private String type;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private String imageUrl;
    private Boolean allowShipProposals;
    /** Pôles rattachés (LOGISTIQUE, MILITAIRE, INDUSTRIE) ; absent ou vide : aucun. */
    private java.util.List<String> poles;
    /** Ancien champ à pôle unique, lu seulement si {@code poles} est absent. */
    private String pole;

    /** Pôles demandés : {@code poles}, ou à défaut l'ancien champ {@code pole}. */
    public java.util.List<String> requestedPoles() {
        if (poles != null) return poles;
        return pole == null ? java.util.List.of() : java.util.List.of(pole);
    }
}


