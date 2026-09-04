package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.response.admin.CatalogPageDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.catalog.CatalogBrowseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/catalog")
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class CatalogAdminController {
    private final CatalogBrowseService catalogBrowseService;

    public CatalogAdminController(CatalogBrowseService catalogBrowseService) {
        this.catalogBrowseService = catalogBrowseService;
    }

    @GetMapping("/entries")
    public ResponseEntity<MessageResponse<CatalogPageDTO>> browse(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String family,
            @RequestParam(defaultValue = "ACTIVE") String status,
            @RequestParam(defaultValue = "ALL") String image,
            @RequestParam(required = false) String source,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int pageSize
    ) {
        return catalogBrowseService.browse(query, family, status, image, source, sort, page, pageSize);
    }
}
