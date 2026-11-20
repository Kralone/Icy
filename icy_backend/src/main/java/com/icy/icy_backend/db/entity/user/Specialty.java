package com.icy.icy_backend.db.entity.user;

import com.icy.icy_backend.exception.definition.BadRequestException;

/** Pôle d'un Spécialiste : un sous-grade, qui n'existe que pour le grade SPECIALISTE. */
public enum Specialty {
    LOGISTIQUE,
    MILITAIRE,
    INDUSTRIE;

    public static final String RANK = "SPECIALISTE";

    /**
     * Sous-grade à enregistrer pour un grade donné : obligatoire pour un Spécialiste, effacé pour tout autre grade.
     */
    public static Specialty forRank(String rank, String requested) {
        if (rank == null || !RANK.equals(rank.trim().toUpperCase())) {
            return null;
        }
        if (requested == null || requested.isBlank()) {
            throw new BadRequestException("Choisissez le pôle du Spécialiste : Logistique, Militaire ou Industrie.");
        }
        try {
            return valueOf(requested.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Pôle de Spécialiste inconnu : " + requested);
        }
    }
}
