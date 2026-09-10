package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.service.catalog.CatalogCorrectionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/catalog/corrections")
@PreAuthorize("hasRole('ADMIN')")
public class CatalogCorrectionController {
    private final CatalogCorrectionService service;
    public CatalogCorrectionController(CatalogCorrectionService service) { this.service=service; }
    @GetMapping("/entries/{id}/image") public CatalogCorrectionService.ImageCorrection image(@PathVariable long id) { return service.image(id); }
    @PutMapping("/entries/{id}/image") public CatalogCorrectionService.ImageCorrection saveImage(@PathVariable long id,@RequestBody ImageRequest request) { return service.saveImage(id,request.url()); }
    @DeleteMapping("/entries/{id}/image") public CatalogCorrectionService.ImageCorrection resetImage(@PathVariable long id) { return service.resetImage(id); }
    @GetMapping("/offers") public CatalogCorrectionService.OfferPage offers(@RequestParam(defaultValue="false") boolean corrected,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="0") int page) { return service.offers(corrected,query,page); }
    @GetMapping("/offers/{id}/candidates") public List<CatalogCorrectionService.Candidate> candidates(@PathVariable long id,@RequestParam(defaultValue="") String query) { return service.candidates(id,query); }
    @PutMapping("/offers/{id}/association") public void associate(@PathVariable long id,@RequestBody AssociationRequest request) { service.associate(id,request.entryId()); }
    @DeleteMapping("/offers/{id}/association") public void resetAssociation(@PathVariable long id) { service.resetAssociation(id); }
    public record ImageRequest(String url) {}
    public record AssociationRequest(long entryId) {}
}
