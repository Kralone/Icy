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
    /** Pôle facultatif d'une activité : null si rien n'est choisi, refus d'un pôle inconnu. */
    public static Specialty optional(String requested) {
        if (requested == null || requested.isBlank()) return null;
        try {
            return valueOf(requested.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new BadRequestException("Pôle inconnu : " + requested);
        }
    }

    /** Pôles facultatifs d'une activité, sans doublon et dans l'ordre d'affichage ; refus d'un pôle inconnu. */
    public static java.util.EnumSet<Specialty> optionalAll(java.util.Collection<String> requested) {
        java.util.EnumSet<Specialty> poles = java.util.EnumSet.noneOf(Specialty.class);
        if (requested == null) return poles;
        for (String value : requested) {
            Specialty pole = optional(value);
            if (pole != null) poles.add(pole);
        }
        return poles;
    }

    /** Premier pôle dans l'ordre d'affichage, ou null. */
    public static Specialty first(java.util.Collection<Specialty> poles) {
        return poles == null ? null : poles.stream().filter(java.util.Objects::nonNull).sorted().findFirst().orElse(null);
    }

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
