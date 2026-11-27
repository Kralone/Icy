package com.icy.icy_backend.service.privacy;

import com.icy.icy_backend.service.user.UserAvatarService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Applique les durées de conservation annoncées dans la politique de confidentialité (/confidentialite).
 *
 * <p>En mode {@code report} (par défaut), la purge est exécutée puis annulée : seuls les volumes sont
 * journalisés. En mode {@code apply}, elle est validée et les avatars des comptes anonymisés sont effacés.
 */
@Service
public class DataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(DataRetentionService.class);

    /** Données personnelles d'un membre parti, supprimées lors de l'anonymisation. */
    static final List<String> PERSONAL_TABLES = List.of(
            "core.user_params",
            "core.refresh_tokens",
            "core.notification_subscriptions",
            "core.user_availability",
            "core.user_tutorials",
            "core.user_roles",
            "core.member_follow_up",
            "core.member_reminders",
            "core.direct_messages",
            "core.member_warnings",
            "core.member_sanctions",
            "fleet.user_ships",
            "collections.user_collection",
            "utils.exec_hangar_player_status",
            "goals.goal_members"
    );

    static final String FORMER_MEMBER = "Ancien membre";

    public record Result(boolean applied, Map<String, Integer> counts, List<UUID> anonymizedUsers) {
        public int total() {
            return counts.values().stream().mapToInt(Integer::intValue).sum();
        }
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final UserAvatarService avatars;
    private final String mode;

    public DataRetentionService(JdbcTemplate jdbc, PlatformTransactionManager transactionManager,
                                UserAvatarService avatars,
                                @Value("${iceforge.retention.mode:report}") String mode) {
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(transactionManager);
        this.avatars = avatars;
        this.mode = mode;
    }

    @Scheduled(cron = "${iceforge.retention.cron:0 15 4 * * *}", zone = "Europe/Paris")
    public void scheduledPurge() {
        try {
            Result result = purge("apply".equalsIgnoreCase(mode));
            log.info("Conservation des données ({}) : {} ligne(s) {} {}",
                    result.applied() ? "apply" : "report", result.total(),
                    result.applied() ? "supprimée(s) ou anonymisée(s)" : "seraient supprimées ou anonymisées",
                    result.counts());
        } catch (RuntimeException e) {
            log.error("Purge de conservation des données en échec", e);
        }
    }

    /** Exécute la purge ; si {@code apply} est faux, tout est annulé et seuls les volumes sont renvoyés. */
    public Result purge(boolean apply) {
        Result result = transactions.execute(status -> {
            Map<String, Integer> counts = new LinkedHashMap<>();
            List<UUID> anonymized = anonymizeDepartedMembers(counts);
            purgeRecentHistory(counts);
            if (!apply) {
                status.setRollbackOnly();
            }
            return new Result(apply, counts, anonymized);
        });
        if (apply) {
            for (UUID userId : result.anonymizedUsers()) {
                try {
                    avatars.deleteAvatarOf(userId);
                } catch (IOException e) {
                    log.warn("Avatar de {} non supprimé : {}", userId, e.getMessage());
                }
            }
        }
        return result;
    }

    /** Membres partis depuis plus de 2 ans : données personnelles supprimées, compte rendu anonyme. */
    private List<UUID> anonymizeDepartedMembers(Map<String, Integer> counts) {
        List<UUID> users = jdbc.queryForList("""
                SELECT id FROM core.users
                WHERE active IS FALSE
                  AND anonymized_at IS NULL
                  AND deactivated_at < NOW() - INTERVAL '2 years'
                """, UUID.class);
        counts.put("comptes anonymisés", users.size());
        if (users.isEmpty()) {
            return users;
        }
        UUID[] ids = users.toArray(UUID[]::new);
        // Certaines tables stockent user_id en texte : la comparaison se fait sur la forme texte.
        String[] textIds = users.stream().map(UUID::toString).toArray(String[]::new);
        for (String table : PERSONAL_TABLES) {
            counts.merge(table, jdbc.update("DELETE FROM " + table + " WHERE user_id::text = ANY(?)", (Object) textIds), Integer::sum);
        }
        jdbc.update("UPDATE core.member_warnings SET issued_by_name = ? WHERE issued_by_user_id = ANY(?)", FORMER_MEMBER, ids);
        jdbc.update("UPDATE core.member_sanctions SET decided_by_name = ? WHERE decided_by_user_id = ANY(?)", FORMER_MEMBER, ids);
        jdbc.update("UPDATE core.reminder_campaigns SET created_by_name = ? WHERE created_by = ANY(?)", FORMER_MEMBER, ids);
        jdbc.update("""
                UPDATE core.users SET
                    username = ? || ' ' || LEFT(id::text, 8),
                    discord_id = 'anonymise-' || id::text,
                    password = '!',
                    description = NULL,
                    avatar_url = NULL,
                    favorite_ship_id = NULL,
                    specialty = NULL,
                    last_seen_at = NULL,
                    anonymized_at = NOW()
                WHERE id = ANY(?)
                """, FORMER_MEMBER, ids);
        return users;
    }

    /** Candidatures (6 mois après la décision) et suivi d'activité (1 an). */
    private void purgeRecentHistory(Map<String, Integer> counts) {
        counts.put("candidatures", jdbc.update("""
                DELETE FROM recruitment.recruitment
                WHERE status <> 'PENDING' AND decided_at < NOW() - INTERVAL '6 months'
                """));
        counts.merge("core.member_reminders", jdbc.update("""
                DELETE FROM core.member_reminders r
                USING core.reminder_campaigns c
                WHERE c.id = r.campaign_id
                  AND COALESCE(r.updated_at, r.contacted_at, c.created_at) < NOW() - INTERVAL '1 year'
                """), Integer::sum);
        counts.merge("core.direct_messages", jdbc.update("""
                DELETE FROM core.direct_messages WHERE requested_at < NOW() - INTERVAL '1 year'
                """), Integer::sum);
        counts.merge("core.member_follow_up", jdbc.update("""
                DELETE FROM core.member_follow_up
                WHERE updated_at < NOW() - INTERVAL '1 year'
                  AND (manual_until IS NULL OR manual_until < CURRENT_DATE)
                """), Integer::sum);
    }
}
