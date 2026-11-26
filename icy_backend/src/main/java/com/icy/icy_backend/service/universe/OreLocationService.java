package com.icy.icy_backend.service.universe;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.service.catalog.CatalogOreDistributionService;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Zones de minage : seule source, les fichiers du jeu publiés par le Star Citizen Wiki. */
@Service
public class OreLocationService {
    private final MessageService messageService;
    private final CatalogOreDistributionService catalogOreDistributionService;

    public OreLocationService(MessageService messageService, CatalogOreDistributionService catalogOreDistributionService) {
        this.messageService = messageService;
        this.catalogOreDistributionService = catalogOreDistributionService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OreLocationDTO>>> listLocations() {
        List<OreLocationDTO> rows = catalogOreDistributionService.listLocations();
        return messageService.buildResponse("ore.locations.list", rows, rows.size());
    }
}
