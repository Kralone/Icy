package com.icy.icy_backend.service.catalog;

public class CatalogReviewRequiredException extends RuntimeException {
    private final int conflictCount;

    public CatalogReviewRequiredException(int conflictCount) {
        super(conflictCount + " conflit(s) catalogue requierent un choix");
        this.conflictCount = conflictCount;
    }

    public int getConflictCount() {
        return conflictCount;
    }
}
