package com.icy.icy_backend.controller.privacy;

import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.privacy.DataRetentionService;
import com.icy.icy_backend.service.privacy.PersonalDataExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exercice des droits RGPD, réservé aux Directeurs (procédure : docs/rgpd/procedure-exercice-des-droits.md).
 */
@RestController
@RequestMapping("/api/admin/privacy")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PrivacyAdminController {
    private final PersonalDataExportService exports;
    private final DataRetentionService retention;

    public record ErasureRequest(List<UUID> userIds) {
    }

    /** Copie des données d'un membre (droit d'accès), en JSON téléchargeable. */
    @GetMapping("/members/{userId}/export")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> export(@PathVariable UUID userId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"iceforge-donnees-" + userId + ".json\"")
                .body(exports.export(userId));
    }

    /** Effacement sur demande ; rejouable après une restauration (les comptes déjà anonymisés sont ignorés). */
    @PostMapping("/erasures")
    public DataRetentionService.Result erase(@RequestBody ErasureRequest request,
                                             @AuthenticationPrincipal UserAuthDetails admin) {
        List<UUID> ids = request == null || request.userIds() == null ? List.of() : request.userIds();
        return retention.eraseOnRequest(ids, admin == null ? null : admin.getId());
    }
}
