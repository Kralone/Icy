package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.auth.RefreshTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Coupe les accès d'un membre quand son compte est désactivé (bouton « Désactiver » ou exclusion) : refresh tokens
 * du site révoqués, sessions d'Icy Companion supprimées, message RabbitMQ pour le service compagnon.
 * Une erreur ici est journalisée et ne fait jamais échouer la désactivation elle-même.
 */
@Component
public class MemberAccessRevocation {
    public static final String EXCLUDED = "EXCLUDED";
    public static final String DEACTIVATED = "DEACTIVATED";
    public static final String PASSWORD_RESET = "PASSWORD_RESET";
    public static final String REVOKED = "REVOKED";

    private static final Logger log = LoggerFactory.getLogger(MemberAccessRevocation.class);
    private final RefreshTokenService refreshTokens;
    private final CompanionSessionService companionSessions;

    public MemberAccessRevocation(RefreshTokenService refreshTokens, CompanionSessionService companionSessions) {
        this.refreshTokens = refreshTokens;
        this.companionSessions = companionSessions;
    }

    /** Site et compagnon. */
    public void revokeEverywhere(User user, String reason) {
        try {
            refreshTokens.revokeAllForUser(user);
        } catch (Exception e) {
            log.warn("Révocation des refresh tokens du site impossible pour le membre {}", user.getId(), e);
        }
        revokeCompanion(user, reason);
    }

    /** Compagnon seulement (le site a déjà révoqué ses propres jetons). */
    public void revokeCompanion(User user, String reason) {
        try {
            companionSessions.revokeAll(user, reason);
        } catch (Exception e) {
            log.warn("Révocation des sessions du compagnon impossible pour le membre {}", user.getId(), e);
        }
    }
}
