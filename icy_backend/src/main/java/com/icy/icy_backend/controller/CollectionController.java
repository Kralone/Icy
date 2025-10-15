package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.*;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.CollectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/collections")
@RequiredArgsConstructor
@Slf4j
public class CollectionController {

    private final CollectionService collectionService;

    // =======================
    // ===== TEMPLATES =======
    // =======================

    @GetMapping("/templates")
    public List<TemplateListItemDTO> getTemplates(
            @RequestParam(required = false) String archetype,
            @RequestParam(required = false, name = "q") String query) {
        log.debug("Récupération des templates (archetype={}, query={})", archetype, query);
        return collectionService.getTemplates(archetype, query);
    }

    @GetMapping("/templates/{id}")
    public TemplateDetailDTO getTemplate(@PathVariable Long id) {
        log.debug("Récupération du template id={}", id);
        return collectionService.getTemplate(id);
    }

    // ==============================
    // ===== USER COLLECTIONS =======
    // ==============================

    @PostMapping("/import")
    public UserCollectionDetailDTO importTemplate(@RequestBody Map<String, Object> body) {
        UUID userId = AuthUtils.getCurrentUserId();
        Long templateId = ((Number) body.get("templateId")).longValue();
        String name = (String) body.get("name");

        log.debug("Import d’un template {} pour userId={} avec nom={}", templateId, userId, name);
        return collectionService.importTemplate(userId.toString(), templateId, name);
    }

    @GetMapping("/me")
    public List<UserCollectionListItemDTO> getUserCollections() {
        UUID userId = AuthUtils.getCurrentUserId();
        log.debug("Récupération des collections pour userId={}", userId);
        return collectionService.getUserCollections(userId.toString());
    }

    @GetMapping("/me/{id}")
    public UserCollectionDetailDTO getUserCollection(@PathVariable Long id) {
        UUID userId = AuthUtils.getCurrentUserId();
        log.debug("Récupération de la collection id={} pour userId={}", id, userId);
        return collectionService.getUserCollection(userId.toString(), id);
    }

    @PatchMapping("/me/{id}/cell")
    public List<String> patchCell(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        UUID userId = AuthUtils.getCurrentUserId();
        String x = (String) body.get("x");
        String y = (String) body.get("y");
        Boolean checked = (Boolean) body.get("checked");

        log.debug("PATCH cell pour userId={}, collectionId={}, x={}, y={}, checked={}", userId, id, x, y, checked);
        return collectionService.patchCell(userId.toString(), id, x, y, checked);
    }

    @DeleteMapping("/me/{id}")
    public void deleteUserCollection(@PathVariable Long id) {
        UUID userId = AuthUtils.getCurrentUserId();
        log.debug("Suppression de la collection id={} pour userId={}", id, userId);
        collectionService.deleteUserCollection(userId.toString(), id);
    }

    @PostMapping("/templates")
    public TemplateDetailDTO createTemplate(@RequestBody TemplateCreateDTO dto) {
        return collectionService.createTemplate(dto);
    }

}
