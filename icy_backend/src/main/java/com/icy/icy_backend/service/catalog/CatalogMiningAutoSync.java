package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Relit chaque jour les minerais de l'API Star Citizen Wiki (compositions, chances d'apparition, amas)
 * pour que les zones de minage suivent les patchs sans import manuel.
 */
@Component
public class CatalogMiningAutoSync {
    private static final Logger logger = LoggerFactory.getLogger(CatalogMiningAutoSync.class);

    private final CatalogSyncService syncService;
    private final boolean enabled;

    public CatalogMiningAutoSync(
            CatalogSyncService syncService,
            @Value("${icy.catalog-sync.mining-auto-enabled:true}") boolean enabled
    ) {
        this.syncService = syncService;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${icy.catalog-sync.mining-auto-cron:0 30 5 * * *}", zone = "Europe/Paris")
    public void refreshMiningData() {
        if (!enabled) return;
        try {
            syncService.startScrapeAndMap(CatalogSyncScope.COMMODITIES.name());
            logger.info("Synchronisation automatique des minerais Star Citizen Wiki lancée");
        } catch (ResourceAlreadyExistsException exception) {
            logger.info("Synchronisation des minerais reportée : un traitement catalogue est déjà en cours");
        } catch (RuntimeException exception) {
            logger.warn("Synchronisation automatique des minerais impossible", exception);
        }
    }
}
