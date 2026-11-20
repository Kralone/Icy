package com.icy.icy_backend.controller.dto.availability;

import java.util.List;
import java.util.UUID;

/**
 * Disponibilités habituelles des membres (/api/availability), à l'heure de Paris.
 * day : jour ISO (1 = lundi) ; period : MORNING, AFTERNOON, EVENING ou NIGHT (la nuit appartient au jour où elle commence).
 */
public final class AvailabilityDtos {
    private AvailabilityDtos() {
    }

    public record Slot(int day, String period) {
    }

    /** Remplace toutes les disponibilités du joueur connecté ; une liste vide les efface. */
    public record UpdateRequest(List<Slot> slots) {
    }

    public record Mine(List<Slot> slots) {
    }

    /** Un membre actif et ses créneaux, pour la grille commune ; slots vide s'il n'a rien renseigné. */
    public record Member(UUID userId, String username, String avatarUrl, List<Slot> slots) {
    }
}
