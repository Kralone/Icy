package com.icy.icy_backend.service.session;

import com.fasterxml.jackson.databind.JsonNode;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Données UEX utiles aux fiches de minage, lues dans le cache local (utils.uex_dataset_cache) :
 * minerais raffinés, raffineries, méthodes de raffinage, terminaux de vente et prix.
 * Aucune valeur n'est inventée : un champ absent de la source reste absent (null).
 */
@Service
@RequiredArgsConstructor
public class MiningMarketService {
    private final UexDatasetCacheRepository cacheRepository;

    public record Commodity(int id, String name, String code) {
    }

    public record Terminal(int id, String name, String location, String system, boolean refinery) {
    }

    public record Method(String code, String name, Integer ratingYield, Integer ratingSpeed, Integer ratingCost) {
    }

    /** Point de vente : prix par SCU, demande (null si la source ne la donne pas) et date du relevé. */
    public record SalePoint(Terminal terminal, int pricePerScu, Integer demandScu, OffsetDateTime observedAt) {
    }

    public record Reference(List<Commodity> commodities, List<Terminal> refineries, List<Method> methods, List<Terminal> saleTerminals, OffsetDateTime pricesFetchedAt) {
    }

    public Reference reference() {
        List<Terminal> terminals = new ArrayList<>(terminals().values());
        Map<Integer, List<SalePoint>> prices = salePoints();
        List<Terminal> saleTerminals = prices.values().stream().flatMap(List::stream).map(SalePoint::terminal)
                .collect(Collectors.toMap(Terminal::id, terminal -> terminal, (left, right) -> left, LinkedHashMap::new))
                .values().stream().sorted(Comparator.comparing(Terminal::name, String.CASE_INSENSITIVE_ORDER)).toList();
        List<Terminal> refineries = terminals.stream().filter(Terminal::refinery)
                .sorted(Comparator.comparing(Terminal::name, String.CASE_INSENSITIVE_ORDER)).toList();
        return new Reference(new ArrayList<>(commodities().values()), refineries, methods(), saleTerminals, fetchedAt("commodities_prices"));
    }

    /** Minerais raffinés vendables, par identifiant UEX. */
    public Map<Integer, Commodity> commodities() {
        Map<Integer, Commodity> result = new LinkedHashMap<>();
        for (JsonNode row : rows("commodities")) {
            if (row.path("is_mineral").asInt(0) != 1 || row.path("is_refined").asInt(0) != 1) continue;
            String name = text(row, "name");
            if (name == null || !row.path("id").canConvertToInt()) continue;
            result.put(row.path("id").asInt(), new Commodity(row.path("id").asInt(), name, text(row, "code")));
        }
        return result.values().stream().sorted(Comparator.comparing(Commodity::name, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toMap(Commodity::id, commodity -> commodity, (left, right) -> left, LinkedHashMap::new));
    }

    public Map<Integer, Terminal> terminals() {
        Map<Integer, Terminal> result = new LinkedHashMap<>();
        for (JsonNode row : rows("terminals")) {
            if (!row.path("id").canConvertToInt()) continue;
            String name = firstText(row, "displayname", "name", "nickname");
            if (name == null) continue;
            boolean refinery = row.path("is_refinery").asInt(0) == 1 && String.valueOf(text(row, "name")).toLowerCase().contains("refinery");
            result.put(row.path("id").asInt(), new Terminal(row.path("id").asInt(), refinery ? firstText(row, "space_station_name", "displayname", "name") : name,
                    location(row), text(row, "star_system_name"), refinery));
        }
        return result;
    }

    public List<Method> methods() {
        List<Method> result = new ArrayList<>();
        for (JsonNode row : rows("refineries_methods")) {
            String code = text(row, "code");
            String name = text(row, "name");
            if (code == null || name == null) continue;
            result.add(new Method(code, name, integer(row, "rating_yield"), integer(row, "rating_speed"), integer(row, "rating_cost")));
        }
        result.sort(Comparator.comparing(Method::name, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    /** Points de vente par minerai, du meilleur prix au moins bon. */
    public Map<Integer, List<SalePoint>> salePoints() {
        Map<Integer, Terminal> terminals = terminals();
        Map<Integer, List<SalePoint>> result = new LinkedHashMap<>();
        for (JsonNode row : rows("commodities_prices")) {
            int price = row.path("price_sell").asInt(0);
            if (price <= 0 || !row.path("id_commodity").canConvertToInt() || !row.path("id_terminal").canConvertToInt()) continue;
            Terminal terminal = terminals.get(row.path("id_terminal").asInt());
            if (terminal == null) {
                String name = text(row, "terminal_name");
                if (name == null) continue;
                terminal = new Terminal(row.path("id_terminal").asInt(), name, null, null, false);
            }
            // scu_sell : quantité que le terminal annonce accepter. 0 ou absent : demande inconnue, jamais présentée comme nulle.
            int demand = row.path("scu_sell").asInt(0);
            long modified = row.path("date_modified").asLong(0);
            OffsetDateTime observedAt = modified > 0 ? OffsetDateTime.ofInstant(Instant.ofEpochSecond(modified), ZoneOffset.UTC) : null;
            result.computeIfAbsent(row.path("id_commodity").asInt(), key -> new ArrayList<>())
                    .add(new SalePoint(terminal, price, demand > 0 ? demand : null, observedAt));
        }
        result.values().forEach(list -> list.sort(Comparator.comparingInt(SalePoint::pricePerScu).reversed()
                .thenComparing(point -> point.terminal().name(), String.CASE_INSENSITIVE_ORDER)));
        return result;
    }

    public OffsetDateTime fetchedAt(String datasetKey) {
        return cacheRepository.findById(datasetKey).map(UexDatasetCache::getFetchedAt).orElse(null);
    }

    private Iterable<JsonNode> rows(String datasetKey) {
        Optional<JsonNode> payload = cacheRepository.findById(datasetKey).map(UexDatasetCache::getPayload);
        return payload.filter(JsonNode::isArray).map(node -> (Iterable<JsonNode>) node).orElse(List.of());
    }

    /** Système › planète ou lune › station, ville ou avant-poste, avec seulement les niveaux connus. */
    private static String location(JsonNode row) {
        List<String> parts = new ArrayList<>();
        addIfPresent(parts, text(row, "star_system_name"));
        addIfPresent(parts, firstText(row, "moon_name", "planet_name", "orbit_name"));
        addIfPresent(parts, firstText(row, "space_station_name", "city_name", "outpost_name"));
        return parts.isEmpty() ? null : String.join(" › ", parts);
    }

    private static void addIfPresent(List<String> parts, String value) {
        if (value != null && !parts.contains(value)) parts.add(value);
    }

    private static String firstText(JsonNode row, String... fields) {
        for (String field : fields) {
            String value = text(row, field);
            if (value != null) return value;
        }
        return null;
    }

    private static String text(JsonNode row, String field) {
        JsonNode value = row.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        String text = value.asText("").trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer integer(JsonNode row, String field) {
        JsonNode value = row.path(field);
        return value.canConvertToInt() ? value.asInt() : null;
    }
}
