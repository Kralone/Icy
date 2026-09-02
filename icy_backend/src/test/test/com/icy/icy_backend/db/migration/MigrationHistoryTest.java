package com.icy.icy_backend.db.migration;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class MigrationHistoryTest {

    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");
    private static final Path CHECKSUMS = Path.of("src/test/resources/db/migration-history.sha256");
    private static final Pattern FILE_NAME = Pattern.compile("^V(\\d+)__([a-z0-9_]+)\\.sql$");
    private static final int LOCKED_THROUGH_VERSION = 29;

    @Test
    void versionsAreUniqueContiguousAndNamedConsistently() throws IOException {
        List<Migration> migrations = migrations();

        assertThat(migrations).isNotEmpty();
        assertThat(migrations)
                .extracting(Migration::version)
                .doesNotHaveDuplicates()
                .containsExactly(IntStream.rangeClosed(1, migrations.getLast().version()).boxed().toArray(Integer[]::new));
    }

    @Test
    void deliveredMigrationsRemainImmutable() throws IOException {
        Map<String, String> expectedChecksums = checksumManifest();
        List<Migration> delivered = migrations().stream()
                .filter(migration -> migration.version() <= LOCKED_THROUGH_VERSION)
                .toList();

        assertThat(delivered).hasSize(LOCKED_THROUGH_VERSION);
        assertThat(expectedChecksums).hasSize(LOCKED_THROUGH_VERSION);
        assertThat(expectedChecksums.keySet())
                .containsExactlyInAnyOrderElementsOf(delivered.stream().map(Migration::fileName).toList());

        for (Migration migration : delivered) {
            assertThat(sha256(normalizedText(migration.path())))
                    .as("La migration livrée %s ne doit plus être modifiée", migration.fileName())
                    .isEqualTo(expectedChecksums.get(migration.fileName()));
        }
    }

    @Test
    void noNewMigrationDuplicatesExistingSql() throws IOException {
        Map<String, List<Integer>> versionsBySql = new HashMap<>();
        for (Migration migration : migrations()) {
            versionsBySql.computeIfAbsent(normalizedSql(migration.path()), ignored -> new ArrayList<>())
                    .add(migration.version());
        }

        List<List<Integer>> duplicates = versionsBySql.values().stream()
                .filter(versions -> versions.size() > 1)
                .map(List::copyOf)
                .toList();

        assertThat(duplicates)
                .as("Deux migrations ne doivent jamais contenir le même SQL")
                .isEmpty();
    }

    private static List<Migration> migrations() throws IOException {
        try (var files = Files.list(MIGRATIONS)) {
            return files
                    .filter(path -> path.getFileName().toString().startsWith("V"))
                    .map(MigrationHistoryTest::migration)
                    .sorted(Comparator.comparingInt(Migration::version))
                    .toList();
        }
    }

    private static Migration migration(Path path) {
        String fileName = path.getFileName().toString();
        Matcher matcher = FILE_NAME.matcher(fileName);
        assertThat(matcher.matches())
                .as("Nom de migration invalide : %s", fileName)
                .isTrue();
        return new Migration(Integer.parseInt(matcher.group(1)), path);
    }

    private static Map<String, String> checksumManifest() throws IOException {
        Map<String, String> checksums = new HashMap<>();
        for (String line : Files.readAllLines(CHECKSUMS, StandardCharsets.UTF_8)) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            String[] parts = trimmed.split("\\s+", 2);
            assertThat(parts).as("Ligne de manifeste invalide : %s", line).hasSize(2);
            assertThat(checksums.put(parts[1], parts[0]))
                    .as("Entrée dupliquée dans le manifeste : %s", parts[1])
                    .isNull();
        }
        return checksums;
    }

    private static String normalizedText(Path path) throws IOException {
        String content = Files.readString(path, StandardCharsets.UTF_8)
                .replace("\r\n", "\n")
                .replace('\r', '\n');
        return content.startsWith("\uFEFF") ? content.substring(1) : content;
    }

    private static String normalizedSql(Path path) throws IOException {
        return normalizedText(path)
                .replaceAll("(?m)--.*$", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponible", exception);
        }
    }

    private record Migration(int version, Path path) {
        private String fileName() {
            return path.getFileName().toString();
        }
    }
}
