package com.icy.icy_backend.service.common;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chaque clé passée à MessageService.buildResponse doit exister dans messages.properties avec ses quatre parties.
 * Une clé absente n'est pas vue par les tests qui simulent MessageService : l'action réussit en base puis la
 * réponse échoue en 500 (désignation d'un pilote, recette du 13 octobre 2026).
 */
class MessageKeysTest {
    private static final Pattern KEY = Pattern.compile("buildResponse\\(\\s*\"([A-Za-z0-9_.\\-]+)\"");

    @Test
    void everyResponseKeyUsedByTheCodeIsFullyDefined() throws IOException {
        Properties messages = new Properties();
        try (InputStream input = getClass().getResourceAsStream("/messages.properties")) {
            messages.load(new InputStreamReader(input, StandardCharsets.UTF_8));
        }
        Path sources = Path.of("src", "main", "java");
        assertThat(sources).as("sources de l'application, relatives au dossier du module").isDirectory();

        TreeSet<String> used = new TreeSet<>();
        try (Stream<Path> files = Files.walk(sources)) {
            for (Path file : files.filter(path -> path.toString().endsWith(".java")).toList()) {
                Matcher matcher = KEY.matcher(Files.readString(file));
                while (matcher.find()) used.add(matcher.group(1));
            }
        }
        assertThat(used).as("clés trouvées dans le code").hasSizeGreaterThan(50);

        TreeSet<String> missing = new TreeSet<>();
        for (String key : used) {
            for (String part : new String[]{".http", ".code", ".title", ".message"}) {
                if (!messages.containsKey(key + part)) missing.add(key + part);
            }
        }
        assertThat(missing).as("clés utilisées par le code mais absentes de messages.properties").isEmpty();
        for (String key : used) {
            assertThat(messages.getProperty(key + ".http")).as(key + ".http").matches("[1-5][0-9]{2}");
            assertThat(messages.getProperty(key + ".code")).as(key + ".code").matches("[0-9]+");
        }
    }
}
