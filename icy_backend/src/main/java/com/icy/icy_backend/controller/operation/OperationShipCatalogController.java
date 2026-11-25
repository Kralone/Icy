package com.icy.icy_backend.controller.operation;

import com.icy.icy_backend.controller.dto.response.admin.CatalogPageDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.catalog.CatalogBrowseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recherche de vaisseaux pour l'éditeur d'opération. Le catalogue d'administration est réservé aux
 * administrateurs et officiers ; un référent de pôle qui organise une opération doit pourtant choisir
 * les vaisseaux de ses équipages. Lecture seule, limitée aux vaisseaux actifs.
 */
@RestController
@RequestMapping("/api/operations/ship-catalog")
public class OperationShipCatalogController {
    private final CatalogBrowseService catalogBrowseService;

    public OperationShipCatalogController(CatalogBrowseService catalogBrowseService) {
        this.catalogBrowseService = catalogBrowseService;
    }

    @GetMapping
    @PreAuthorize("@poleAccess.canCreate()")
    public ResponseEntity<MessageResponse<CatalogPageDTO>> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int pageSize
    ) {
        return catalogBrowseService.browse(query, "SHIP", "ALL", "ACTIVE", "ALL", null, "name", page, pageSize);
    }
}
