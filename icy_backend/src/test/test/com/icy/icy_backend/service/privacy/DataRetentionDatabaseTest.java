package com.icy.icy_backend.service.privacy;

import com.icy.icy_backend.service.user.UserAvatarService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Runs the retention purge on the explicitly supplied migrated validation database. Every change is rolled back. */
@EnabledIfEnvironmentVariable(named = "CATALOG_TEST_JDBC_URL", matches = ".+")
class DataRetentionDatabaseTest {

    Connection connection;
    JdbcTemplate jdbc;
    UserAvatarService avatars;
    DataRetentionService service;

    @BeforeEach
    void setup() throws Exception {
        connection = DriverManager.getConnection(System.getenv("CATALOG_TEST_JDBC_URL"),
                System.getenv("CATALOG_TEST_DB_USER"), System.getenv("CATALOG_TEST_DB_PASSWORD"));
        connection.setAutoCommit(false);
        jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
        avatars = mock(UserAvatarService.class);
        service = new DataRetentionService(jdbc, new SavepointTransactions(connection), avatars, "report");
        // Only the fixtures below are eligible, whatever the validation database already holds.
        jdbc.update("UPDATE core.users SET anonymized_at = NOW() WHERE active IS FALSE");
        jdbc.update("UPDATE recruitment.recruitment SET status = 'PENDING'");
        jdbc.update("DELETE FROM core.member_reminders");
        jdbc.update("DELETE FROM core.direct_messages");
        jdbc.update("DELETE FROM core.member_follow_up");
    }

    @AfterEach
    void cleanup() throws Exception {
        if (connection != null) {
            connection.rollback();
            connection.close();
        }
    }

    UUID member(String name, boolean active, String deactivatedAgo) {
        UUID id = jdbc.queryForObject("""
                INSERT INTO core.users(username, discord_id, password, description, specialty)
                VALUES (?, ?, 'hash', 'Bio', 'INDUSTRIE') RETURNING id
                """, UUID.class, name, "discord-" + name);
        jdbc.update("INSERT INTO core.user_params(user_id) VALUES (?)", id);
        jdbc.update("INSERT INTO core.user_availability(user_id, day_of_week, period) VALUES (?, 2, 'EVENING')", id);
        if (!active) {
            jdbc.update("UPDATE core.users SET active = FALSE WHERE id = ?", id);
            jdbc.update("UPDATE core.users SET deactivated_at = NOW() - CAST(? AS INTERVAL) WHERE id = ?", deactivatedAgo, id);
        }
        return id;
    }

    long recruitment(String status, String decidedAgo) {
        long id = jdbc.queryForObject("""
                INSERT INTO recruitment.recruitment(username, discord_tag, motivation, status)
                VALUES ('Candidat', 'candidat#0001', 'Motivation', ?) RETURNING id
                """, Long.class, status);
        if (decidedAgo != null) {
            jdbc.update("UPDATE recruitment.recruitment SET decided_at = NOW() - CAST(? AS INTERVAL) WHERE id = ?", decidedAgo, id);
        }
        return id;
    }

    int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void deactivationAndDecisionDatesAreRecordedByTheDatabase() {
        UUID id = member("Retention Trigger", true, null);
        jdbc.update("UPDATE core.users SET active = FALSE WHERE id = ?", id);
        assertThat(count("SELECT COUNT(*) FROM core.users WHERE id = ? AND deactivated_at IS NOT NULL", id)).isEqualTo(1);
        jdbc.update("UPDATE core.users SET active = TRUE WHERE id = ?", id);
        assertThat(count("SELECT COUNT(*) FROM core.users WHERE id = ? AND deactivated_at IS NULL", id)).isEqualTo(1);

        long candidate = recruitment("PENDING", null);
        jdbc.update("UPDATE recruitment.recruitment SET status = 'REJECTED' WHERE id = ?", candidate);
        assertThat(count("SELECT COUNT(*) FROM recruitment.recruitment WHERE id = ? AND decided_at IS NOT NULL", candidate)).isEqualTo(1);
    }

    @Test
    void anonymizesMembersGoneForTwoYearsAndKeepsSharedHistory() throws Exception {
        UUID gone = member("Retention Gone", false, "3 years");
        UUID recent = member("Retention Recent", false, "1 year");
        UUID active = member("Retention Active", true, null);
        jdbc.update("INSERT INTO bank.entries(kind, amount, occurred_on, recorded_by, user_id) VALUES ('DEPOSIT', 1000, CURRENT_DATE, ?, ?)", active, gone);
        jdbc.update("INSERT INTO core.member_warnings(user_id, category, reason, rank, issued_by_user_id, issued_by_name, created_at) VALUES (?, 'COMPORTEMENT', 'Motif', 1, ?, 'Retention Gone', NOW())", active, gone);

        DataRetentionService.Result result = service.purge(true);

        assertThat(result.anonymizedUsers()).containsExactly(gone);
        assertThat(jdbc.queryForObject("SELECT username FROM core.users WHERE id = ?", String.class, gone)).startsWith("Ancien membre ");
        assertThat(jdbc.queryForObject("SELECT discord_id FROM core.users WHERE id = ?", String.class, gone)).isEqualTo("anonymise-" + gone);
        assertThat(count("SELECT COUNT(*) FROM core.users WHERE id = ? AND description IS NULL AND specialty IS NULL", gone)).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM core.user_availability WHERE user_id = ?", gone)).isZero();
        assertThat(count("SELECT COUNT(*) FROM core.user_params WHERE user_id = ?", gone)).isZero();
        assertThat(count("SELECT COUNT(*) FROM bank.entries WHERE user_id = ?", gone)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT issued_by_name FROM core.member_warnings WHERE user_id = ?", String.class, active)).isEqualTo("Ancien membre");
        verify(avatars).deleteAvatarOf(gone);

        assertThat(jdbc.queryForObject("SELECT username FROM core.users WHERE id = ?", String.class, recent)).isEqualTo("Retention Recent");
        assertThat(count("SELECT COUNT(*) FROM core.user_availability WHERE user_id IN (?, ?)", recent, active)).isEqualTo(2);
        assertThat(service.purge(true).anonymizedUsers()).isEmpty();
    }

    @Test
    void deletesDecidedApplicationsAfterSixMonths() {
        long old = recruitment("REJECTED", "7 months");
        long fresh = recruitment("ACCEPTED", "1 month");
        long pending = recruitment("PENDING", null);

        service.purge(true);

        assertThat(count("SELECT COUNT(*) FROM recruitment.recruitment WHERE id = ?", old)).isZero();
        assertThat(count("SELECT COUNT(*) FROM recruitment.recruitment WHERE id IN (?, ?)", fresh, pending)).isEqualTo(2);
    }

    @Test
    void deletesActivityHistoryAfterOneYear() {
        UUID active = member("Retention History", true, null);
        jdbc.update("INSERT INTO core.direct_messages(id, user_id, origin, requested_at, status) VALUES (gen_random_uuid(), ?, 'REMINDER', NOW() - INTERVAL '13 months', 'SENT')", active);
        jdbc.update("INSERT INTO core.direct_messages(id, user_id, origin, requested_at, status) VALUES (gen_random_uuid(), ?, 'REMINDER', NOW() - INTERVAL '2 months', 'SENT')", active);
        jdbc.update("INSERT INTO core.member_follow_up(user_id, manual_state, note, updated_at) VALUES (?, 'EN_PAUSE', 'Note', NOW() - INTERVAL '13 months')", active);

        service.purge(true);

        assertThat(count("SELECT COUNT(*) FROM core.direct_messages WHERE user_id = ?", active)).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM core.member_follow_up WHERE user_id = ?", active)).isZero();
    }

    @Test
    void reportModeCountsWithoutChangingAnything() throws Exception {
        UUID gone = member("Retention Report", false, "3 years");
        long old = recruitment("REJECTED", "7 months");

        DataRetentionService.Result result = service.purge(false);

        assertThat(result.applied()).isFalse();
        assertThat(result.counts()).containsEntry("comptes anonymisés", 1).containsEntry("candidatures", 1);
        assertThat(jdbc.queryForObject("SELECT username FROM core.users WHERE id = ?", String.class, gone)).isEqualTo("Retention Report");
        assertThat(count("SELECT COUNT(*) FROM recruitment.recruitment WHERE id = ?", old)).isEqualTo(1);
        verify(avatars, never()).deleteAvatarOf(gone);
    }

    /** Commits release a savepoint and rollbacks return to it, so the test transaction stays open. */
    static final class SavepointTransactions implements PlatformTransactionManager {
        private final Connection connection;
        private Savepoint savepoint;

        SavepointTransactions(Connection connection) {
            this.connection = connection;
        }

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            try {
                savepoint = connection.setSavepoint();
            } catch (SQLException e) {
                throw new IllegalStateException(e);
            }
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            try {
                if (status.isRollbackOnly()) {
                    connection.rollback(savepoint);
                } else {
                    connection.releaseSavepoint(savepoint);
                }
            } catch (SQLException e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public void rollback(TransactionStatus status) {
            try {
                connection.rollback(savepoint);
            } catch (SQLException e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
