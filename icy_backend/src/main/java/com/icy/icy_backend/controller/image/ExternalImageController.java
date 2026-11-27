package com.icy.icy_backend.controller.image;

import com.icy.icy_backend.service.image.ExternalImageMirrorService;
import com.icy.icy_backend.service.image.ExternalImageMirrorService.Report;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Images affichées depuis d'autres sites : liste, puis copie dans la banque d'images. */
@RestController
@RequestMapping("/api/admin/images/external")
@PreAuthorize("hasRole('ADMIN')")
public class ExternalImageController {

    private final ExternalImageMirrorService mirror;

    public ExternalImageController(ExternalImageMirrorService mirror) {
        this.mirror = mirror;
    }

    /** Liste seulement : rien n'est téléchargé ni modifié. */
    @GetMapping
    public ResponseEntity<Report> list() {
        return ResponseEntity.ok(mirror.scan());
    }

    /** Copie au plus {@code limit} nouvelles images, puis remplace les liens de toutes celles déjà copiées. */
    @PostMapping("/mirror")
    public ResponseEntity<Report> mirror(@RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(mirror.mirror(Math.max(0, Math.min(limit, 2000))));
    }
}
