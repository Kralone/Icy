package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

/** Enrichment keeps the actual variant loadout separate from a base-model illustration. */
final class WikiVehicleEnrichment {
    static final String GUIDE = "https://starcitizen.tools/Guide:Executive_Hangars";
    private final RestTemplate rest;
    private final String userAgent;

    WikiVehicleEnrichment(RestTemplate rest, String userAgent) {
        this.rest = rest;
        this.userAgent = userAgent;
    }

    static boolean isSpecial(JsonNode vehicle) {
        String name = vehicle.path("name").asText();
        return name.contains("PYAM Exec") || name.contains("Wikelo");
    }

    void enrich(List<JsonNode> vehicles) {
        // Complete list first: a variant's base model can be on a later API page.
        Map<String, JsonNode> bases = new LinkedHashMap<>();
        for (JsonNode vehicle : vehicles) if (!isSpecial(vehicle)) {
            String key = baseName(vehicle.path("name").asText());
            if (!bases.containsKey(key) || hasImage(vehicle)) bases.put(key, vehicle);
        }
        for (JsonNode base : bases.values()) if (!hasImage(base)) {
            String name = baseName(base.path("name").asText());
            String url = UriComponentsBuilder.fromUriString("https://starcitizen.tools/")
                    .pathSegment(name.replace(' ', '_')).build().encode().toUriString();
            // Image lookup is optional; an unavailable illustration must not abort catalog import.
            try {
                String image = html(url).select("meta[property=og:image]").attr("content");
                if (image.startsWith("https://media.starcitizen.tools/")) {
                    ((ObjectNode) base).putArray("images").addObject().put("original_url", image);
                    ((ObjectNode) base).put("image_source_page", url);
                }
            } catch (org.springframework.web.client.RestClientException ignored) { }
        }
        for (JsonNode vehicle : vehicles) if (isSpecial(vehicle) && !hasImage(vehicle)) {
            JsonNode base = bases.get(baseName(vehicle.path("name").asText()));
            if (base != null && hasImage(base)) {
                ((ObjectNode) vehicle).set("images", base.path("images").deepCopy());
                ((ObjectNode) vehicle).put("image_source_vehicle_uuid", base.path("uuid").asText());
                ((ObjectNode) vehicle).put("image_is_base", true);
            }
        }
        if (vehicles.stream().noneMatch(WikiVehicleEnrichment::isSpecial)) return;
        Document guide = html(GUIDE);
        var content = guide.selectFirst(".mw-parser-output");
        var lists = content == null ? List.<org.jsoup.nodes.Element>of() : content.select("ul").stream()
                .filter(candidate -> !candidate.select("li > a[href]").isEmpty())
                .filter(candidate -> candidate.select("li > a[href]").stream()
                        .allMatch(link -> link.text().contains("Executive") || link.text().contains("Wikelo")))
                .toList();
        if (lists.size() != 1) throw new IllegalStateException("Liste Executive Hangars absente ou ambiguë du guide Wiki");
        var list = lists.getFirst();
        if (list == null || list.select("li > a[href]").isEmpty())
            throw new IllegalStateException("Liste Executive Hangars absente du guide Wiki");
        for (JsonNode vehicle : vehicles) ((ObjectNode) vehicle).put("executive_hangar", false);
        for (var link : list.select("li > a[href]")) {
            String base = link.attr("href").replaceFirst("^/", "").replace('_', ' ');
            boolean executive = link.text().contains("Executive");
            List<JsonNode> matches = vehicles.stream().filter(v -> baseName(v.path("name").asText()).equals(base))
                    .filter(v -> executive ? v.path("name").asText().contains("PYAM Exec")
                            : link.text().endsWith(v.path("name").asText())
                                // The guide labels it War; the actual API and Executive ship guide call it Sneak.
                                // https://sc-exec-ships.vercel.app/
                                || (base.equals("Scorpius") && link.text().endsWith("Scorpius Wikelo War Special")
                                    && v.path("name").asText().equals("Scorpius Wikelo Sneak Special"))).toList();
            if (matches.isEmpty()) throw new IllegalStateException("Récompense Executive absente du catalogue : " + base);
            if (!executive && matches.size() != 1)
                throw new IllegalStateException("Variante Executive ambiguë : " + base);
            for (JsonNode match : matches) {
                ((ObjectNode) match).put("executive_hangar", true);
                ((ObjectNode) match).put("executive_hangar_source", GUIDE);
            }
        }
    }

    static String baseName(String name) {
        String base = name.replaceFirst("\\s+(PYAM Exec|Wikelo).*$", "").replaceFirst("^MISC ", "");
        return "Hornet F7A Mk II".equals(base) ? "F7A Hornet Mk II" : base;
    }

    private static boolean hasImage(JsonNode vehicle) {
        for (JsonNode image : vehicle.path("images"))
            if (!image.path("original_url").asText("").isBlank() || !image.path("thumbnail_url").asText("").isBlank()) return true;
        return false;
    }

    private Document html(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, userAgent);
        return Jsoup.parse(Objects.requireNonNull(rest.exchange(url, HttpMethod.GET,
                new HttpEntity<>(headers), String.class).getBody()), url);
    }
}
