package com.icy.icy_backend.service.image;

import com.icy.icy_backend.db.entity.image.ImageMetadata;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.io.IOException;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Copies external images on the explicitly supplied migrated validation database. Every change is rolled back. */
@EnabledIfEnvironmentVariable(named = "CATALOG_TEST_JDBC_URL", matches = ".+")
class ExternalImageMirrorDatabaseTest {

    static final byte[] PNG = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0};
    static final String WIKI = "https://media.starcitizen.tools/a/ab/Ship.png";
    static final String ARTICLE = "https://static0.example-news.com/mole.jpg";

    Connection connection;
    JdbcTemplate jdbc;
    ImageService images;
    ExternalImageFetcher fetcher;
    ExternalImageMirrorService service;

    @BeforeEach
    void setup() throws Exception {
        connection = DriverManager.getConnection(System.getenv("CATALOG_TEST_JDBC_URL"),
                System.getenv("CATALOG_TEST_DB_USER"), System.getenv("CATALOG_TEST_DB_PASSWORD"));
        connection.setAutoCommit(false);
        jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
        images = mock(ImageService.class);
        fetcher = mock(ExternalImageFetcher.class);
        when(images.storeImported(anyString(), any(), anyString())).thenAnswer(call -> {
            ImageMetadata meta = new ImageMetadata();
            meta.setUrl("https://iceforge.fr/images/" + call.getArgument(0));
            return meta;
        });
        service = new ExternalImageMirrorService(jdbc, images, fetcher, "https://iceforge.fr/images/", "off");
        // Only the fixtures below are external, whatever the validation database already holds.
        for (ExternalImageMirrorService.Source source : ExternalImageMirrorService.SOURCES) {
            if (!source.html()) {
                jdbc.update("UPDATE " + source.table() + " SET " + source.column() + " = '/assets/test.png' WHERE "
                        + source.column() + " ~* 'https?://'");
            }
        }
        jdbc.update("DELETE FROM news.news");
        jdbc.update("DELETE FROM public.content_guides");
        jdbc.update("DELETE FROM core.pole_news");
        jdbc.update("DELETE FROM icelink.icelink_block");
        jdbc.update("INSERT INTO fleet.brand(name, image_url) VALUES ('Marque test', ?)", WIKI);
        jdbc.update("INSERT INTO fleet.brand(name, image_url) VALUES ('Marque locale', '/images/local.png')");
        long type = jdbc.queryForObject("INSERT INTO news.news_type(name, color) VALUES ('Type test', '#fff') RETURNING id", Long.class);
        jdbc.update("""
                INSERT INTO news.news(title, content, image_url, type_id, author)
                VALUES ('Titre', ?, ?, ?, 'Auteur')
                """, "<p>Voir <a href=\"https://robertsspaceindustries.com/comm-link\">l'annonce</a></p>"
                + "<img alt=\"\" src=\"" + ARTICLE + "\"><img src=\"" + WIKI + "\">", WIKI, type);
    }

    @AfterEach
    void cleanup() throws Exception {
        if (connection != null) {
            connection.rollback();
            connection.close();
        }
    }

    @Test
    void listsWithoutDownloadingOrChangingAnything() throws IOException {
        ExternalImageMirrorService.Report report = service.scan();

        assertThat(report.applied()).isFalse();
        assertThat(report.images()).extracting(ExternalImageMirrorService.Found::url).containsExactly(WIKI, ARTICLE);
        assertThat(report.images().getFirst().usedIn()).containsExactlyInAnyOrder("fleet.brand.image_url",
                "news.news.image_url", "news.news.content");
        assertThat(report.byHost()).containsEntry("media.starcitizen.tools", 1).containsEntry("static0.example-news.com", 1);
        verify(fetcher, never()).fetch(any());
        assertThat(jdbc.queryForObject("SELECT image_url FROM fleet.brand WHERE name = 'Marque test'", String.class))
                .isEqualTo(WIKI);
    }

    @Test
    void mirrorsEachImageOnceAndReplacesLinksEverywhere() throws IOException {
        when(fetcher.fetch(any())).thenReturn(PNG);

        ExternalImageMirrorService.Report first = service.mirror(100);

        assertThat(first.mirrored()).isEqualTo(2);
        String brand = jdbc.queryForObject("SELECT image_url FROM fleet.brand WHERE name = 'Marque test'", String.class);
        assertThat(brand).startsWith("https://iceforge.fr/images/ext-").endsWith(".png");
        String content = jdbc.queryForObject("SELECT content FROM news.news", String.class);
        assertThat(content).doesNotContain(WIKI, ARTICLE).contains("https://robertsspaceindustries.com/comm-link");
        assertThat(jdbc.queryForObject("SELECT image_url FROM news.news", String.class)).isEqualTo(brand);
        assertThat(jdbc.queryForObject("SELECT image_url FROM fleet.brand WHERE name = 'Marque locale'", String.class))
                .isEqualTo("/images/local.png");

        // Relancé : plus rien d'externe, rien n'est retéléchargé ; un nouveau lien vers une image copiée est remplacé.
        jdbc.update("INSERT INTO fleet.brand(name, image_url) VALUES ('Marque revenue', ?)", WIKI);
        ExternalImageMirrorService.Report second = service.mirror(100);
        assertThat(second.mirrored()).isZero();
        assertThat(second.alreadyMirrored()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT image_url FROM fleet.brand WHERE name = 'Marque revenue'", String.class))
                .isEqualTo(brand);
        verify(fetcher, times(2)).fetch(any());
        assertThat(service.scan().externalImages()).isZero();
    }

    @Test
    void keepsTheOriginalLinkWhenTheDownloadIsNotAnImage() throws IOException {
        when(fetcher.fetch(URI.create(WIKI))).thenReturn("<html>".getBytes());
        when(fetcher.fetch(URI.create(ARTICLE))).thenThrow(new IOException("réponse HTTP 404"));

        ExternalImageMirrorService.Report report = service.mirror(100);

        assertThat(report.failed()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT image_url FROM fleet.brand WHERE name = 'Marque test'", String.class))
                .isEqualTo(WIKI);
        assertThat(jdbc.queryForObject("SELECT last_error FROM media.external_image_mirror WHERE source_url = ?",
                String.class, ARTICLE)).isEqualTo("réponse HTTP 404");
        verify(images, never()).storeImported(anyString(), any(), eq("media.starcitizen.tools"));
    }

    @Test
    void respectsTheDownloadLimit() throws IOException {
        when(fetcher.fetch(any())).thenReturn(PNG);

        assertThat(service.mirror(1).mirrored()).isEqualTo(1);
        assertThat(service.scan().externalImages()).isEqualTo(1);
    }
}
