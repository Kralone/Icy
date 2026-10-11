package com.icy.icy_backend.integration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Opt-in proof that PostgreSQL serializes two capacity writers on the same row.
 *
 * The normal Maven suite stays database-independent. Run this test with
 * -Diceforge.integration=true and the local PostgreSQL values from
 * secrets/local.secrets.env when the validation database is available.
 */
@EnabledIfSystemProperty(named = "iceforge.integration", matches = "true")
class OperationCapacityPostgresLockIT {
    @Test
    void secondCapacityWriterWaitsUntilFirstTransactionCommits() throws Exception {
        String url = System.getProperty("iceforge.jdbc.url", "jdbc:postgresql://localhost:15432/iceforgedb");
        String user = System.getProperty("iceforge.jdbc.user", "iceforge");
        String password = System.getProperty("iceforge.jdbc.password", "iceforge");
        String table = "operation_capacity_lock_probe_" + UUID.randomUUID().toString().replace('-', '_');
        CountDownLatch firstLocked = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try (Connection setup = DriverManager.getConnection(url, user, password);
             Statement statement = setup.createStatement()) {
            statement.execute("CREATE TABLE " + table + " (id integer primary key, confirmed integer not null)");
            statement.execute("INSERT INTO " + table + " (id, confirmed) VALUES (1, 0)");

            Future<?> first = executor.submit(() -> withConnection(url, user, password, connection -> {
                connection.setAutoCommit(false);
                try (Statement lock = connection.createStatement();
                     ResultSet ignored = lock.executeQuery("SELECT id FROM " + table + " WHERE id = 1 FOR UPDATE")) {
                    assertThat(ignored.next()).isTrue();
                    firstLocked.countDown();
                    Thread.sleep(400);
                    connection.commit();
                }
            }));
            assertThat(firstLocked.await(5, TimeUnit.SECONDS)).isTrue();

            Future<?> second = executor.submit(() -> withConnection(url, user, password, connection -> {
                connection.setAutoCommit(false);
                try (Statement lock = connection.createStatement();
                     ResultSet ignored = lock.executeQuery("SELECT id FROM " + table + " WHERE id = 1 FOR UPDATE")) {
                    assertThat(ignored.next()).isTrue();
                    connection.commit();
                }
            }));

            Thread.sleep(150);
            assertThat(second).isNotDone();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
        } finally {
            try (Connection cleanup = DriverManager.getConnection(url, user, password);
                 Statement statement = cleanup.createStatement()) {
                statement.execute("DROP TABLE IF EXISTS " + table);
            }
            executor.shutdownNow();
            executor.awaitTermination(Duration.ofSeconds(5).toMillis(), TimeUnit.MILLISECONDS);
        }
    }

    private static void withConnection(String url, String user, String password, SqlWork work) {
        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            work.run(connection);
        } catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }

    @FunctionalInterface
    private interface SqlWork {
        void run(Connection connection) throws Exception;
    }
}
