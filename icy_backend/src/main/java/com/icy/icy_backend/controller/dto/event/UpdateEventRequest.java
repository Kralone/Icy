package com.icy.icy_backend.controller.dto.event;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class UpdateEventRequest {
    private UUID id;
    private String type;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private boolean finished;
    /** Changement de date d'un événement classique : vrai pour garder les réponses déjà données. Absent : elles sont effacées, comme avant. */
    private Boolean keepParticipants;
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


