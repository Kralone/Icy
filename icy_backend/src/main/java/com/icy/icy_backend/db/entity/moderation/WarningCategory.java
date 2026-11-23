package com.icy.icy_backend.db.entity.moderation;

/** Nature d'un avertissement ; le libellé affiché est porté par l'interface et par le message du bot. */
public enum WarningCategory {
    COMPORTEMENT("Comportement"),
    REGLEMENT("Non-respect du règlement"),
    ABSENCE("Absence sans prévenir"),
    OPERATION("Conduite en opération"),
    AUTRE("Autre motif");

    private final String label;

    WarningCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
