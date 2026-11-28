package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.entity.user.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Sessions de l'app Icy Companion : une ligne de oauth2_authorization par connexion de l'app, tenue par l'émetteur.
 * Supprimer la ligne rend son refresh token inutilisable ; le message RabbitMQ coupe le jeton d'accès en cours.
 * <p>
 * Fonctionne même quand l'émetteur est désactivé (la table existe toujours) : il n'y a alors simplement aucune session.
 */
@Service
public class CompanionSessionService {

    public record CompanionSession(String id, OffsetDateTime connectedAt, OffsetDateTime lastRefreshAt, OffsetDateTime expiresAt) {}

    private final JdbcTemplate jdbc;
    private final CompanionAuthEvents events;

    public CompanionSessionService(JdbcTemplate jdbc, CompanionAuthEvents events) {
        this.jdbc = jdbc;
        this.events = events;
    }

    public List<CompanionSession> sessionsOf(User user) {
        return jdbc.query("""
                        SELECT id, authorization_code_issued_at, access_token_issued_at, refresh_token_expires_at
                        FROM oauth2_authorization
                        WHERE registered_client_id = ? AND principal_name = ? AND refresh_token_value IS NOT NULL
                        ORDER BY access_token_issued_at DESC NULLS LAST""",
                (rs, i) -> new CompanionSession(rs.getString(1),
                        rs.getObject(2, OffsetDateTime.class),
                        rs.getObject(3, OffsetDateTime.class),
                        rs.getObject(4, OffsetDateTime.class)),
                CompanionAuthProperties.APP_CLIENT_ID, user.getUsername());
    }

    /** Nom d'utilisateur du propriétaire d'une session, vide si elle n'existe pas. */
    public Optional<String> ownerOf(String sessionId) {
        return jdbc.query("SELECT principal_name FROM oauth2_authorization WHERE id = ? AND registered_client_id = ?",
                (rs, i) -> rs.getString(1), sessionId, CompanionAuthProperties.APP_CLIENT_ID).stream().findFirst();
    }

    /** Déconnecte une seule session de l'app (un appareil). */
    public boolean revokeSession(User owner, String sessionId) {
        int deleted = jdbc.update("DELETE FROM oauth2_authorization WHERE id = ? AND registered_client_id = ? AND principal_name = ?",
                sessionId, CompanionAuthProperties.APP_CLIENT_ID, owner.getUsername());
        if (deleted > 0) events.sessionRevoked(owner.getId(), sessionId);
        return deleted > 0;
    }

    /**
     * Coupe tout accès du membre au compagnon : sessions supprimées et message « membre révoqué », envoyé même
     * s'il n'avait aucune session (un jeton d'accès peut encore circuler quelques minutes).
     */
    public void revokeAll(User user, String reason) {
        jdbc.update("DELETE FROM oauth2_authorization WHERE registered_client_id = ? AND principal_name = ?",
                CompanionAuthProperties.APP_CLIENT_ID, user.getUsername());
        events.memberRevoked(user.getId(), reason);
    }

    /** Ménage quotidien : sessions expirées et connexions abandonnées en cours de route. */
    @Scheduled(cron = "${icy.companion-auth.purge-cron:0 30 4 * * *}", zone = "Europe/Paris")
    public void purgeExpired() {
        jdbc.update("""
                DELETE FROM oauth2_authorization
                WHERE GREATEST(refresh_token_expires_at, access_token_expires_at, authorization_code_expires_at)
                      < NOW() - INTERVAL '1 hour'""");
    }
}
