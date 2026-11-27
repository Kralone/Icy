package com.icy.icy_backend.service.privacy;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Copie des données d'un membre (RGPD art. 15), au format JSON, pour répondre à une demande d'accès.
 * Les secrets (mot de passe, empreintes de jetons, clés de notification) ne sont jamais exportés.
 */
@Service
public class PersonalDataExportService {

    /** Table, colonne qui désigne le membre, colonnes à exporter. */
    record Source(String table, String userColumn, String columns) {
    }

    static final List<Source> SOURCES = List.of(
            new Source("core.users", "id",
                    "id, username, discord_id, description, status, specialty, avatar_url, favorite_ship_id, active, created_at, last_seen_at, deactivated_at"),
            new Source("core.user_params", "user_id", "*"),
            new Source("core.user_availability", "user_id", "*"),
            new Source("core.user_tutorials", "user_id", "*"),
            new Source("core.notification_subscriptions", "user_id", "id, user_agent, created_at, updated_at"),
            new Source("core.member_follow_up", "user_id", "*"),
            new Source("core.member_reminders", "user_id", "*"),
            new Source("core.direct_messages", "user_id", "*"),
            new Source("core.member_warnings", "user_id", "*"),
            new Source("core.member_sanctions", "user_id", "*"),
            new Source("fleet.user_ships", "user_id", "*"),
            new Source("collections.user_collection", "user_id", "*"),
            new Source("goals.goal_members", "user_id", "*"),
            new Source("goals.goal_participations", "user_id", "*"),
            new Source("events.event_participation", "user_id", "*"),
            new Source("events.operation_assignments", "user_id", "*"),
            new Source("events.operation_assignment_requests", "user_id", "*"),
            new Source("scworld.sc_world_event_participation", "user_id", "*"),
            new Source("utils.exec_hangar_player_status", "user_id", "*"),
            new Source("bank.entries", "user_id", "*"),
            new Source("session.participants", "user_id", "*"),
            new Source("session.expenses", "payer_user_id", "*"),
            new Source("session.sales", "seller_user_id", "*"),
            new Source("session.settlement_shares", "user_id", "*"),
            new Source("mining.refinery_orders", "recipient_user_id", "*")
    );

    private final JdbcTemplate jdbc;

    public PersonalDataExportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> export(UUID userId) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Source source : SOURCES) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT " + source.columns() + " FROM " + source.table()
                            + " WHERE " + source.userColumn() + "::text = ?", userId.toString());
            if (!rows.isEmpty()) {
                result.put(source.table(), rows);
            }
        }
        return result;
    }
}
