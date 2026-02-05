package com.icy.icy_backend.controller.image;

import com.icy.icy_backend.controller.image.dto.ImageUpdateRequest;
import com.icy.icy_backend.db.entity.image.ImageMetadata;
import com.icy.icy_backend.db.entity.image.ImageTag;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.image.ImageService;
import com.icy.icy_backend.service.user.UserService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService imageService;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    // === PUBLIC ===
    @GetMapping
    public ResponseEntity<List<ImageMetadata>> listImages() throws IOException {
        log.debug("Récupération de la liste d’images");
        return ResponseEntity.ok(imageService.listAll());
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> listCategories() {
        return ResponseEntity.ok(imageService.listCategories());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/categories")
    public ResponseEntity<Void> createCategory(@RequestBody Map<String, String> payload) {
        imageService.createCategory(payload.get("name"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories/{category}/subcategories")
    public ResponseEntity<List<String>> listSubcategories(@PathVariable String category) {
        return ResponseEntity.ok(imageService.listSubcategories(category));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/categories/{category}/subcategories")
    public ResponseEntity<Void> createSubcategory(@PathVariable String category,
                                                  @RequestBody Map<String, String> payload) {
        imageService.createSubcategory(category, payload.get("name"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tags")
    public ResponseEntity<List<ImageTag>> listTags() {
        return ResponseEntity.ok(imageService.listTags());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/tags")
    public ResponseEntity<Void> upsertTags(@RequestBody Map<String, String> tagColors) {
        imageService.upsertTagColors(tagColors);
        return ResponseEntity.noContent().build();
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
    public ResponseEntity<ImageMetadata> uploadImage(@RequestParam("file") MultipartFile file,
                                                     @RequestParam(value = "tags", required = false) String tagsRaw,
                                                     @RequestParam(value = "category", required = false) String category,
                                                     @RequestParam(value = "subcategory", required = false) String subcategory,
                                                     @RequestParam(value = "tagColors", required = false) String tagColorsRaw)
            throws IOException {
        UUID userId = AuthUtils.getCurrentUserId();
        String username = userService.findUserById(AuthUtils.getCurrentUserId()).getUsername();

        log.info("Upload d’une image (admin) par {} [{}]", username, userId);

        List<String> tags = parseTags(tagsRaw);
        Map<String, String> tagColors = parseTagColors(tagColorsRaw);
        ImageMetadata metadata = imageService.upload(file, userId, username, tags, category, subcategory, tagColors);
        return ResponseEntity.ok(metadata);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{filename:.+}")
    public ResponseEntity<Void> deleteImage(@PathVariable String filename) throws IOException {
        log.info("Suppression d’une image : {}", filename);
        imageService.delete(filename);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}")
    public ResponseEntity<ImageMetadata> updateImage(@PathVariable UUID id,
                                                     @RequestBody ImageUpdateRequest request) {
        ImageMetadata updated = imageService.updateMetadata(
                id,
                request.category(),
                request.subcategory(),
                request.tags(),
                request.tagColors()
        );
        return ResponseEntity.ok(updated);
    }

    private List<String> parseTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private Map<String, String> parseTagColors(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.warn("Impossible de parser tagColors, ignoré.");
            return Collections.emptyMap();
        }
    }
}




