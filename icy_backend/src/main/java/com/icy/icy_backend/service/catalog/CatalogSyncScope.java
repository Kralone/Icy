package com.icy.icy_backend.service.catalog;

import java.util.Locale;

public enum CatalogSyncScope {
    VEHICLES("vehicles"),
    ITEMS("items"),
    LOCATIONS("locations"),
    ECONOMY(null),
    WIKELO(null);

    private final String wikiDataset;

    CatalogSyncScope(String wikiDataset) {
        this.wikiDataset = wikiDataset;
    }

    public String wikiDataset() {
        return wikiDataset;
    }

    public static CatalogSyncScope parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Le scope a mapper est requis");
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
