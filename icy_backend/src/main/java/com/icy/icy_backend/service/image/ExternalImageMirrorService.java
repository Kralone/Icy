package com.icy.icy_backend.service.image;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rapatrie dans la banque d'images les images affichées depuis d'autres sites, puis remplace leurs liens.
 * Le navigateur des visiteurs n'appelle alors plus ces sites. Relançable : une image déjà copiée n'est
 * plus téléchargée, et un lien déjà remplacé n'apparaît plus.
 */
@Service
public class ExternalImageMirrorService {

    private static final Logger log = LoggerFactory.getLogger(ExternalImageMirrorService.class);

    /** Colonne qui contient soit un lien d'image, soit du HTML où chercher des images. */
    public record Source(String table, String column, boolean html) {
        String label() {
            return table + "." + column;
        }
    }

    static final List<Source> SOURCES = List.of(
            new Source("catalog.entries", "image_url", false),
            new Source("catalog.entries", "image_override_url", false),
            new Source("events.event_types", "image_url", false),
            new Source("events.operations", "image_url", false),
            new Source("fleet.brand", "image_url", false),
            new Source("fleet.items", "image_url", false),
            new Source("news.news", "image_url", false),
            new Source("news.news_type", "image_url", false),
            new Source("public.celestial_bodies", "image_url", false),
            new Source("public.orbital_stations", "image_url", false),
            new Source("scworld.sc_world_event", "banner_image_url", false),
            new Source("scworld.sc_world_event_type", "image_url", false),
            new Source("utils.wikelo_ships", "reward_image_url", false),
            new Source("core.users", "avatar_url", false),
            new Source("news.news", "content", true),
            new Source("public.content_guides", "content", true),
            new Source("core.pole_news", "content", true),
            new Source("icelink.icelink_block", "content", true)
    );

    private static final Pattern HTML_IMAGE = Pattern.compile(
            "(?:<img\\b[^>]*?\\ssrc\\s*=\\s*[\"']|url\\(\\s*[\"']?)(https?://[^\"'\\s)<>]+)",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", ".png", "image/jpeg", ".jpg", "image/gif", ".gif",
            "image/webp", ".webp", "image/avif", ".avif");

    /** Une image externe : où elle apparaît et si elle a déjà une copie locale. */
    public record Found(String url, String host, List<String> usedIn, String localUrl, String lastError) {
    }

    public record Report(boolean applied, int externalImages, int alreadyMirrored, int mirrored, int failed,
                         int rowsUpdated, Map<String, Integer> byHost, List<Found> images) {
    }

    private final JdbcTemplate jdbc;
    private final ImageService images;
    private final ExternalImageFetcher fetcher;
    private final Set<String> localHosts;
    private final String scheduleMode;

    public ExternalImageMirrorService(JdbcTemplate jdbc, ImageService images, ExternalImageFetcher fetcher,
                                      @Value("${icy.image.base-url:http://localhost:8088/images/}") String imageBaseUrl,
                                      @Value("${iceforge.images.mirror.mode:off}") String scheduleMode) {
        this.jdbc = jdbc;
        this.images = images;
        this.fetcher = fetcher;
        this.scheduleMode = scheduleMode;
        Set<String> hosts = new LinkedHashSet<>(List.of("iceforge.fr", "www.iceforge.fr", "localhost"));
        String baseHost = hostOf(imageBaseUrl);
        if (baseHost != null) {
            hosts.add(baseHost);
        }
        this.localHosts = Set.copyOf(hosts);
    }

    /** Après la synchronisation du catalogue : les nouvelles images sont copiées la nuit même. */
    @Scheduled(cron = "${iceforge.images.mirror.cron:0 45 4 * * *}", zone = "Europe/Paris")
    public void scheduledMirror() {
        if (!"apply".equalsIgnoreCase(scheduleMode) && !"report".equalsIgnoreCase(scheduleMode)) {
            return;
        }
        try {
            Report report = "apply".equalsIgnoreCase(scheduleMode) ? mirror(500) : scan();
            log.info("Images externes ({}) : {} trouvée(s), {} copiée(s), {} en échec, {} ligne(s) mises à jour, par site {}",
                    report.applied() ? "apply" : "report", report.externalImages(), report.mirrored(),
                    report.failed(), report.rowsUpdated(), report.byHost());
        } catch (RuntimeException e) {
            log.error("Copie des images externes en échec", e);
        }
    }

    /** Liste seulement : rien n'est téléchargé ni modifié. */
    public Report scan() {
        Map<String, List<String>> found = collect();
        Map<String, Map<String, Object>> known = knownMirrors(found.keySet());
        List<Found> list = new ArrayList<>();
        Map<String, Integer> byHost = new TreeMap<>();
        int already = 0;
        for (Map.Entry<String, List<String>> entry : found.entrySet()) {
            Map<String, Object> mirror = known.get(entry.getKey());
            String localUrl = mirror == null ? null : (String) mirror.get("local_url");
            String error = mirror == null ? null : (String) mirror.get("last_error");
            if (localUrl != null) {
                already++;
            }
            String host = hostOf(entry.getKey());
            byHost.merge(host, 1, Integer::sum);
            list.add(new Found(entry.getKey(), host, entry.getValue(), localUrl, error));
        }
        return new Report(false, found.size(), already, 0, 0, 0, byHost, list);
    }

    /**
     * Télécharge au plus {@code limit} nouvelles images, puis remplace les liens de toutes celles qui ont une
     * copie locale. Une image refusée (pas une image, trop lourde, site injoignable) garde son lien d'origine.
     */
    public Report mirror(int limit) {
        Map<String, List<String>> found = collect();
        Map<String, Map<String, Object>> known = knownMirrors(found.keySet());
        Map<String, String> local = new LinkedHashMap<>();
        Map<String, Integer> byHost = new TreeMap<>();
        int mirrored = 0;
        int failed = 0;
        int already = 0;
        int attempts = 0;
        List<Found> list = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : found.entrySet()) {
            String url = entry.getKey();
            String host = hostOf(url);
            byHost.merge(host, 1, Integer::sum);
            Map<String, Object> mirror = known.get(url);
            String localUrl = mirror == null ? null : (String) mirror.get("local_url");
            String error = mirror == null ? null : (String) mirror.get("last_error");
            if (localUrl != null) {
                already++;
            } else if (attempts < limit) {
                attempts++;
                try {
                    localUrl = download(url, host);
                    mirrored++;
                    error = null;
                } catch (IOException | RuntimeException e) {
                    failed++;
                    error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    jdbc.update("""
                            INSERT INTO media.external_image_mirror (source_url, last_error, failed_at)
                            VALUES (?, ?, NOW())
                            ON CONFLICT (source_url) DO UPDATE SET last_error = EXCLUDED.last_error, failed_at = NOW()
                            """, url, truncate(error));
                    log.warn("Image externe non copiée {} : {}", url, error);
                }
            }
            if (localUrl != null) {
                local.put(url, localUrl);
            }
            list.add(new Found(url, host, entry.getValue(), localUrl, error));
        }
        int rows = replaceLinks(local);
        return new Report(true, found.size(), already, mirrored, failed, rows, byHost, list);
    }

    private String download(String url, String host) throws IOException {
        byte[] content = fetcher.fetch(URI.create(url));
        String type = ImageContentValidator.detectContentType(content);
        if (type == null) {
            throw new IllegalArgumentException("le contenu n'est pas une image acceptée");
        }
        String name = "ext-" + shortHash(url) + EXTENSIONS.get(type);
        var meta = images.storeImported(name, content, host);
        jdbc.update("""
                INSERT INTO media.external_image_mirror (source_url, image_name, local_url, bytes, mirrored_at)
                VALUES (?, ?, ?, ?, NOW())
                ON CONFLICT (source_url) DO UPDATE SET image_name = EXCLUDED.image_name, local_url = EXCLUDED.local_url,
                    bytes = EXCLUDED.bytes, mirrored_at = NOW(), last_error = NULL, failed_at = NULL
                """, url, name, meta.getUrl(), (long) content.length);
        return meta.getUrl();
    }

    private int replaceLinks(Map<String, String> local) {
        int rows = 0;
        for (Map.Entry<String, String> entry : local.entrySet()) {
            for (Source source : SOURCES) {
                if (!exists(source)) {
                    continue;
                }
                if (source.html()) {
                    rows += jdbc.update("UPDATE " + source.table() + " SET " + source.column() + " = replace("
                                    + source.column() + ", ?, ?) WHERE strpos(" + source.column() + ", ?) > 0",
                            entry.getKey(), entry.getValue(), entry.getKey());
                } else {
                    rows += jdbc.update("UPDATE " + source.table() + " SET " + source.column() + " = ? WHERE "
                            + source.column() + " = ?", entry.getValue(), entry.getKey());
                }
            }
        }
        return rows;
    }

    /** Lien externe → colonnes où il apparaît. */
    Map<String, List<String>> collect() {
        Map<String, List<String>> found = new TreeMap<>();
        for (Source source : SOURCES) {
            if (!exists(source)) {
                continue;
            }
            List<String> values = jdbc.queryForList("SELECT DISTINCT " + source.column() + " FROM " + source.table()
                    + " WHERE " + source.column() + " ~* 'https?://'", String.class);
            for (String value : values) {
                for (String url : source.html() ? imagesInHtml(value) : List.of(value.trim())) {
                    if (isExternal(url)) {
                        List<String> usedIn = found.computeIfAbsent(url, k -> new ArrayList<>());
                        if (!usedIn.contains(source.label())) {
                            usedIn.add(source.label());
                        }
                    }
                }
            }
        }
        return found;
    }

    static List<String> imagesInHtml(String html) {
        List<String> urls = new ArrayList<>();
        Matcher matcher = HTML_IMAGE.matcher(html);
        while (matcher.find()) {
            urls.add(matcher.group(1).replace("&amp;", "&"));
        }
        return urls;
    }

    boolean isExternal(String url) {
        String host = hostOf(url);
        return host != null && !localHosts.contains(host);
    }

    private boolean exists(Source source) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_schema || '.' || table_name = ? AND column_name = ?)
                """, Boolean.class, source.table(), source.column()));
    }

    private Map<String, Map<String, Object>> knownMirrors(Set<String> urls) {
        Map<String, Map<String, Object>> known = new LinkedHashMap<>();
        if (urls.isEmpty()) {
            return known;
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT source_url, local_url, last_error FROM media.external_image_mirror WHERE source_url = ANY(?)",
                (Object) urls.toArray(String[]::new))) {
            known.put((String) row.get("source_url"), row);
        }
        return known;
    }

    static String hostOf(String url) {
        if (url == null || !url.regionMatches(true, 0, "http", 0, 4)) {
            return null;
        }
        try {
            String host = URI.create(url.trim().replace(" ", "%20")).getHost();
            return host == null ? null : host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String shortHash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 10);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String value) {
        return value.length() > 500 ? value.substring(0, 500) : value;
    }
}
