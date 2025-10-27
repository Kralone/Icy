package com.icy.icy_backend.controller;

import com.icy.icy_backend.db.entity.ImageMetadata;
import com.icy.icy_backend.service.UserService;
import com.icy.icy_backend.service.rest.ImageService;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService imageService;
    private final UserService userService;

    // === PUBLIC ===
    @GetMapping
    public ResponseEntity<List<ImageMetadata>> listImages() throws IOException {
        log.debug("Récupération de la liste d’images");
        return ResponseEntity.ok(imageService.listAll());
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> getImage(@PathVariable String filename) {
        log.debug("Récupération de l’image : {}", filename);
        Resource file = imageService.getImage(filename);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(file)
                        .orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(file);
    }

    // === ADMIN ===
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/upload")
    public ResponseEntity<ImageMetadata> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        UUID userId = AuthUtils.getCurrentUserId();
        String username = userService.findUserById(AuthUtils.getCurrentUserId()).getUsername();

        log.info("Upload d’une image (admin) par {} [{}]", username, userId);

        ImageMetadata metadata = imageService.upload(file, userId, username);
        return ResponseEntity.ok(metadata);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{filename:.+}")
    public ResponseEntity<Void> deleteImage(@PathVariable String filename) throws IOException {
        log.info("Suppression d’une image : {}", filename);
        imageService.delete(filename);
        return ResponseEntity.noContent().build();
    }
}
