package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.AuthUtils;

import java.util.Objects;
import java.util.UUID;

/**
 * Droits sur les fiches (docs/mining-v3/SPEC.md, « Droits »), toujours vérifiés côté serveur.
 * Organisateur : le créateur de la fiche ; OFFICIER et ADMIN ont aussi ces droits sur toutes les fiches.
 */
public final class SessionAccess {
    private SessionAccess() {
    }

    public static UUID currentUserId() {
        return AuthUtils.getCurrentUserId();
    }

    /** Créer une fiche : SPÉCIALISTE, OFFICIER ou ADMIN. */
    public static boolean canCreate() {
        return AuthUtils.hasRole("SPECIALISTE") || AuthUtils.hasRole("OFFICIER") || AuthUtils.isAdmin();
    }

    public static boolean isOrganizer(SessionSheet sheet, UUID userId) {
        return Objects.equals(sheet.getOrganizerUserId(), userId) || AuthUtils.hasRole("OFFICIER") || AuthUtils.isAdmin();
    }

    public static void requireCreate() {
        if (!canCreate()) throw new ForbiddenException("Seuls les spécialistes, officiers et administrateurs créent une fiche.");
    }

    public static void requireOrganizer(SessionSheet sheet, UUID userId) {
        if (!isOrganizer(sheet, userId)) throw new ForbiddenException("Action réservée à l’organisateur de la fiche.");
    }

    public static void requireStatus(SessionSheet sheet, SessionSheet.Status expected, String message) {
        if (sheet.getStatus() != expected) throw new BadRequestException(message);
    }

    /** Frais, ordres, ventes et parts ne se modifient que tant que les comptes ne sont pas arrêtés. */
    public static void requireActive(SessionSheet sheet) {
        requireStatus(sheet, SessionSheet.Status.ACTIVE, "Les comptes sont arrêtés : rouvrez la fiche pour la modifier.");
    }
}
