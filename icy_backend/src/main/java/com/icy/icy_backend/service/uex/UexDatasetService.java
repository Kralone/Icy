package com.icy.icy_backend.service.uex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.icy.icy_backend.config.UexProperties;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.UexRefineryDatasetsDTO;
import com.icy.icy_backend.controller.dto.response.front.UexResourceSaleDTO;
import com.icy.icy_backend.controller.dto.response.front.UexVehiclePurchaseDTO;
import com.icy.icy_backend.controller.dto.response.front.UexVehicleRentalDTO;
import com.icy.icy_backend.controller.dto.response.front.UexVehicleTerminalDTO;
import com.icy.icy_backend.controller.dto.utils.UexDatasetDetailDTO;
import com.icy.icy_backend.controller.dto.utils.UexDatasetSummaryDTO;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class UexDatasetService {
    private static final int PREVIEW_LIMIT = 50;
    private static final Map<String, String> SUPPORTED_DATASETS = Map.of(
            "commodities", "/commodities",
            "commodities_prices", "/commodities_prices_all",
            "terminals", "/terminals",
            "refineries_audits", "/refineries_audits",
            "refineries_capacities", "/refineries_capacities",
            "refineries_methods", "/refineries_methods",
            "refineries_yields", "/refineries_yields",
            "vehicles_purchases_prices", "/vehicles_purchases_prices_all",
            "vehicles_rentals_prices", "/vehicles_rentals_prices_all"
    );
    private static final List<String> DEFAULT_SALES_RESOURCE_NAMES = List.of(
            "Ricite", "Stileron", "Savrilium", "Quantanium", "Lindinium", "Bexalite", "Taranite",
            "Diamond", "Gold", "Borase", "Laranite", "Beryl", "Hephaestanite", "Agricium",
            "Ice", "Tungsten", "Titanium", "Torite", "Iron", "Quartz", "Copper", "Corundum",
            "Aluminum", "Tin", "Silicon"
    );
    private static final Map<String, String> RESOURCE_ALIASES = Map.ofEntries(
            Map.entry("ricite", "Riccite"),
            Map.entry("quantanium", "Quantainium"),
            Map.entry("ice", "Raw Ice")
    );
    private static final Map<String, String> VEHICLE_NAME_ALIASES = Map.ofEntries(
            Map.entry("mole", "Argo MOLE"),
            Map.entry("roc", "Greycat ROC")
    );

    private final UexDatasetCacheRepository cacheRepository;
    private final MessageService messageService;
    private final UexProperties uexProperties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    public UexDatasetService(
            UexDatasetCacheRepository cacheRepository,
            MessageService messageService,
            UexProperties uexProperties,
            ObjectMapper objectMapper
    ) {
        this.cacheRepository = cacheRepository;
        this.messageService = messageService;
        this.uexProperties = uexProperties;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexDatasetSummaryDTO>>> listDatasets() {
        Map<String, UexDatasetCache> existingByKey = new LinkedHashMap<>();
        for (UexDatasetCache cache : cacheRepository.findAllByOrderByDatasetKeyAsc()) {
            existingByKey.put(normalizeKey(cache.getDatasetKey()), cache);
        }

        List<UexDatasetSummaryDTO> summaries = SUPPORTED_DATASETS.entrySet().stream()
                .map(entry -> {
                    String datasetKey = entry.getKey();
                    String sourceUrl = buildSourceUrl(entry.getValue());
                    UexDatasetCache existing = existingByKey.get(datasetKey);
                    if (existing == null) {
                        return new UexDatasetSummaryDTO(datasetKey, sourceUrl, 0, null, null);
                    }
                    return new UexDatasetSummaryDTO(existing);
                })
                .toList();

        return messageService.buildResponse("uex.datasets.list", summaries);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<UexDatasetDetailDTO>> getDataset(String datasetKey) {
        String normalizedKey = normalizeKey(datasetKey);
        String endpointPath = SUPPORTED_DATASETS.get(normalizedKey);
        if (endpointPath == null) {
            return messageService.buildResponse("uex.dataset.invalid", null, datasetKey);
        }

        Optional<UexDatasetCache> maybeCache = cacheRepository.findById(normalizedKey);
        if (maybeCache.isEmpty()) {
            UexDatasetDetailDTO emptyDto = new UexDatasetDetailDTO(
                    normalizedKey,
                    buildSourceUrl(endpointPath),
                    0,
                    null,
                    null,
                    objectMapper.nullNode(),
                    0,
                    false
            );
            return messageService.buildResponse("uex.dataset.empty", emptyDto, normalizedKey);
        }

        UexDatasetDetailDTO dto = toDetailDto(maybeCache.get());
        return messageService.buildResponse("uex.dataset.get", dto, normalizedKey);
    }

    @Transactional
    public ResponseEntity<MessageResponse<UexDatasetDetailDTO>> refreshDataset(String datasetKey) {
        String normalizedKey = normalizeKey(datasetKey);
        String endpointPath = SUPPORTED_DATASETS.get(normalizedKey);
        if (endpointPath == null) {
            return messageService.buildResponse("uex.dataset.invalid", null, datasetKey);
        }

        String sourceUrl = buildSourceUrl(endpointPath);
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        if (uexProperties.getApiKey() != null && !uexProperties.getApiKey().isBlank()) {
            headers.setBearerAuth(uexProperties.getApiKey());
        }

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(sourceUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        } catch (Exception ex) {
            return messageService.buildResponse("uex.dataset.invalid", null, "UEX indisponible: " + ex.getMessage());
        }

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().isBlank()) {
            return messageService.buildResponse("uex.dataset.invalid", null, "Reponse UEX invalide pour " + normalizedKey);
        }

        JsonNode dataNode;
        try {
            JsonNode root = objectMapper.readTree(response.getBody());
            if (!"ok".equalsIgnoreCase(root.path("status").asText())) {
                return messageService.buildResponse("uex.dataset.invalid", null, "UEX status non OK pour " + normalizedKey);
            }
            dataNode = root.path("data");
            if (dataNode.isMissingNode() || dataNode.isNull()) {
                return messageService.buildResponse("uex.dataset.invalid", null, "Payload data absent pour " + normalizedKey);
            }
        } catch (Exception ex) {
            return messageService.buildResponse("uex.dataset.invalid", null, "Parsing UEX impossible: " + ex.getMessage());
        }

        int itemCount = resolveItemCount(dataNode);
        UexDatasetCache cache = cacheRepository.findById(normalizedKey).orElseGet(() ->
                new UexDatasetCache(normalizedKey, sourceUrl, objectMapper.createArrayNode(), 0, OffsetDateTime.now(ZoneOffset.UTC), null)
        );
        cache.setSourceUrl(sourceUrl);
        cache.setPayload(dataNode);
        cache.setItemCount(itemCount);
        cache.setFetchedAt(OffsetDateTime.now(ZoneOffset.UTC));

        UexDatasetCache saved = cacheRepository.save(cache);
        UexDatasetDetailDTO dto = toDetailDto(saved);
        return messageService.buildResponse("uex.dataset.refreshed", dto, normalizedKey, itemCount);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexResourceSaleDTO>>> listResourceSales(List<String> requestedNames) {
        return listResourceSales(requestedNames, null);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexResourceSaleDTO>>> listResourceSales(List<String> requestedNames, String preferredTerminal) {
        Optional<UexDatasetCache> commoditiesCache = cacheRepository.findById("commodities");
        Optional<UexDatasetCache> commodityPricesCache = cacheRepository.findById("commodities_prices");

        if (commoditiesCache.isEmpty() || commodityPricesCache.isEmpty()) {
            return messageService.buildResponse("uex.resource.sales.list", List.of(), 0);
        }

        JsonNode commoditiesPayload = commoditiesCache.get().getPayload();
        JsonNode commodityPricesPayload = commodityPricesCache.get().getPayload();
        if (commoditiesPayload == null || !commoditiesPayload.isArray() || commodityPricesPayload == null || !commodityPricesPayload.isArray()) {
            return messageService.buildResponse("uex.resource.sales.list", List.of(), 0);
        }

        Map<String, JsonNode> commoditiesByName = new LinkedHashMap<>();
        for (JsonNode commodityNode : commoditiesPayload) {
            String commodityName = commodityNode.path("name").asText("");
            if (!commodityName.isBlank()) {
                commoditiesByName.put(normalizeKey(commodityName), commodityNode);
            }
        }

        String preferredTerminalNormalized = normalizeKey(preferredTerminal);
        boolean filterByTerminal = !preferredTerminalNormalized.isBlank();
        Map<String, BestSellPrice> bestSellByCommodity = new LinkedHashMap<>();
        Map<String, List<UexResourceSaleDTO.SalePointDTO>> salePointsByCommodity = new LinkedHashMap<>();
        for (JsonNode priceNode : commodityPricesPayload) {
            String commodityName = priceNode.path("commodity_name").asText("");
            if (commodityName.isBlank()) {
                continue;
            }
            int sellPrice = priceNode.path("price_sell").asInt(0);
            if (sellPrice <= 0) {
                continue;
            }

            String normalizedCommodityName = normalizeKey(commodityName);
            String terminal = priceNode.path("terminal_name").asText("").trim();
            if (filterByTerminal && !normalizeKey(terminal).equals(preferredTerminalNormalized)) {
                continue;
            }
            if (!terminal.isBlank()) {
                salePointsByCommodity
                        .computeIfAbsent(normalizedCommodityName, ignored -> new ArrayList<>())
                        .add(new UexResourceSaleDTO.SalePointDTO(terminal, sellPrice));
            }
            BestSellPrice current = bestSellByCommodity.get(normalizedCommodityName);
            if (current == null || sellPrice > current.value()) {
                bestSellByCommodity.put(normalizedCommodityName, new BestSellPrice(sellPrice, terminal.isBlank() ? null : terminal));
            }
        }

        List<UexResourceSaleDTO> rows = new ArrayList<>();
        for (String requestedName : resolveResourceNames(requestedNames)) {
            String canonicalName = canonicalResourceName(requestedName);
            JsonNode commodityNode = commoditiesByName.get(normalizeKey(canonicalName));
            BestSellPrice bestSellPrice = bestSellByCommodity.get(normalizeKey(canonicalName));

            String kind = commodityNode == null ? "Unknown" : commodityNode.path("kind").asText("Unknown");
            int baseSell = commodityNode == null ? 0 : commodityNode.path("price_sell").asInt(0);
            Integer bestSell = bestSellPrice == null ? null : bestSellPrice.value();
            String bestSellTerminal = bestSellPrice == null ? null : bestSellPrice.terminal();
            List<UexResourceSaleDTO.SalePointDTO> salePoints = salePointsByCommodity
                    .getOrDefault(normalizeKey(canonicalName), List.of())
                    .stream()
                    .sorted((left, right) -> Integer.compare(right.getSellPrice(), left.getSellPrice()))
                    .toList();

            rows.add(new UexResourceSaleDTO(
                    requestedName,
                    canonicalName,
                    kind,
                    baseSell,
                    bestSell,
                    bestSellTerminal,
                    salePoints
            ));
        }

        return messageService.buildResponse("uex.resource.sales.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public List<String> suggestSaleTerminals(String query, int maxResults) {
        Optional<UexDatasetCache> commodityPricesCache = cacheRepository.findById("commodities_prices");
        if (commodityPricesCache.isEmpty()) {
            return List.of();
        }

        JsonNode commodityPricesPayload = commodityPricesCache.get().getPayload();
        if (commodityPricesPayload == null || !commodityPricesPayload.isArray()) {
            return List.of();
        }

        String normalizedQuery = normalizeKey(query);
        Set<String> seen = new LinkedHashSet<>();
        List<String> terminals = new ArrayList<>();

        for (JsonNode priceNode : commodityPricesPayload) {
            String terminal = priceNode.path("terminal_name").asText("").trim();
            if (terminal.isBlank()) {
                continue;
            }
            String normalizedTerminal = normalizeKey(terminal);
            if (!normalizedQuery.isBlank() && !normalizedTerminal.contains(normalizedQuery)) {
                continue;
            }
            if (seen.add(normalizedTerminal)) {
                terminals.add(terminal);
            }
        }

        terminals.sort(String.CASE_INSENSITIVE_ORDER);
        int safeLimit = Math.max(1, Math.min(50, maxResults));
        if (terminals.size() > safeLimit) {
            return terminals.subList(0, safeLimit);
        }
        return terminals;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<UexRefineryDatasetsDTO>> getRefineryDatasets() {
        Optional<UexDatasetCache> methodsCache = cacheRepository.findById("refineries_methods");
        Optional<UexDatasetCache> capacitiesCache = cacheRepository.findById("refineries_capacities");
        Optional<UexDatasetCache> yieldsCache = cacheRepository.findById("refineries_yields");
        Optional<UexDatasetCache> auditsCache = cacheRepository.findById("refineries_audits");

        UexRefineryDatasetsDTO dto = new UexRefineryDatasetsDTO(
                extractArrayPayload(methodsCache),
                extractArrayPayload(capacitiesCache),
                extractArrayPayload(yieldsCache),
                extractArrayPayload(auditsCache),
                extractFetchedAt(methodsCache),
                extractFetchedAt(capacitiesCache),
                extractFetchedAt(yieldsCache),
                extractFetchedAt(auditsCache)
        );

        int totalRows = dto.getMethods().size() + dto.getCapacities().size() + dto.getYields().size() + dto.getAudits().size();
        return messageService.buildResponse("uex.resource.refineries.get", dto, totalRows);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexVehiclePurchaseDTO>>> listVehiclePurchases() {
        Optional<UexDatasetCache> purchasesCache = cacheRepository.findById("vehicles_purchases_prices");
        if (purchasesCache.isEmpty()) {
            return messageService.buildResponse("uex.vehicles.purchases.list", List.of(), 0);
        }

        JsonNode payload = purchasesCache.get().getPayload();
        if (payload == null || !payload.isArray()) {
            return messageService.buildResponse("uex.vehicles.purchases.list", List.of(), 0);
        }

        List<UexVehiclePurchaseDTO> rows = new ArrayList<>();
        for (JsonNode row : payload) {
            String vehicleName = normalizeVehicleName(row.path("vehicle_name").asText(""));
            String terminalName = row.path("terminal_name").asText("").trim();
            int buyPrice = row.path("price_buy").asInt(0);

            if (vehicleName.isBlank() || terminalName.isBlank() || buyPrice <= 0) {
                continue;
            }

            rows.add(new UexVehiclePurchaseDTO(vehicleName, terminalName, buyPrice));
        }

        return messageService.buildResponse("uex.vehicles.purchases.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexVehicleRentalDTO>>> listVehicleRentals() {
        Optional<UexDatasetCache> rentalsCache = cacheRepository.findById("vehicles_rentals_prices");
        if (rentalsCache.isEmpty()) {
            return messageService.buildResponse("uex.vehicles.rentals.list", List.of(), 0);
        }

        JsonNode payload = rentalsCache.get().getPayload();
        if (payload == null || !payload.isArray()) {
            return messageService.buildResponse("uex.vehicles.rentals.list", List.of(), 0);
        }

        List<UexVehicleRentalDTO> rows = new ArrayList<>();
        for (JsonNode row : payload) {
            String vehicleName = normalizeVehicleName(row.path("vehicle_name").asText(""));
            String terminalName = row.path("terminal_name").asText("").trim();
            int rentPrice = row.path("price_rent").asInt(0);

            if (vehicleName.isBlank() || terminalName.isBlank() || rentPrice <= 0) {
                continue;
            }

            rows.add(new UexVehicleRentalDTO(vehicleName, terminalName, rentPrice));
        }

        return messageService.buildResponse("uex.vehicles.rentals.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexVehicleTerminalDTO>>> listVehicleTerminals() {
        Optional<UexDatasetCache> terminalsCache = cacheRepository.findById("terminals");
        if (terminalsCache.isEmpty()) {
            return messageService.buildResponse("uex.vehicles.terminals.list", List.of(), 0);
        }

        JsonNode payload = terminalsCache.get().getPayload();
        if (payload == null || !payload.isArray()) {
            return messageService.buildResponse("uex.vehicles.terminals.list", List.of(), 0);
        }

        List<UexVehicleTerminalDTO> rows = new ArrayList<>();
        for (JsonNode row : payload) {
            String name = row.path("name").asText("").trim();
            String nickname = row.path("nickname").asText("").trim();
            String displayName = row.path("displayname").asText("").trim();
            String code = row.path("code").asText("").trim();
            String planetName = row.path("planet_name").asText("").trim();
            String cityName = row.path("city_name").asText("").trim();
            String stationName = row.path("space_station_name").asText("").trim();
            String screenshot = row.path("screenshot").asText("").trim();

            if (name.isBlank() && nickname.isBlank() && displayName.isBlank()) {
                continue;
            }

            rows.add(new UexVehicleTerminalDTO(
                    emptyToNull(name),
                    emptyToNull(nickname),
                    emptyToNull(displayName),
                    emptyToNull(code),
                    emptyToNull(planetName),
                    emptyToNull(cityName),
                    emptyToNull(stationName),
                    emptyToNull(screenshot)
            ));
        }

        return messageService.buildResponse("uex.vehicles.terminals.list", rows, rows.size());
    }

    private UexDatasetDetailDTO toDetailDto(UexDatasetCache cache) {
        JsonNode payloadNode = cache.getPayload() == null ? objectMapper.nullNode() : cache.getPayload();

        PreviewResult preview = buildPreview(payloadNode, PREVIEW_LIMIT);
        return new UexDatasetDetailDTO(
                cache.getDatasetKey(),
                cache.getSourceUrl(),
                cache.getItemCount(),
                cache.getFetchedAt(),
                cache.getUpdatedAt(),
                preview.node(),
                preview.previewItemCount(),
                preview.truncated()
        );
    }

    private PreviewResult buildPreview(JsonNode payloadNode, int limit) {
        if (payloadNode == null || payloadNode.isNull()) {
            return new PreviewResult(objectMapper.nullNode(), 0, false);
        }

        if (payloadNode.isArray()) {
            ArrayNode source = (ArrayNode) payloadNode;
            if (source.size() <= limit) {
                return new PreviewResult(source, source.size(), false);
            }
            ArrayNode preview = objectMapper.createArrayNode();
            for (int i = 0; i < limit; i++) {
                preview.add(source.get(i));
            }
            return new PreviewResult(preview, preview.size(), true);
        }

        if (payloadNode.isObject()) {
            ObjectNode source = (ObjectNode) payloadNode;
            int total = source.size();
            if (total <= limit) {
                return new PreviewResult(source, total, false);
            }
            ObjectNode preview = objectMapper.createObjectNode();
            int count = 0;
            for (var iterator = source.fields(); iterator.hasNext() && count < limit; ) {
                var entry = iterator.next();
                preview.set(entry.getKey(), entry.getValue());
                count++;
            }
            return new PreviewResult(preview, preview.size(), true);
        }

        return new PreviewResult(payloadNode, 1, false);
    }

    private int resolveItemCount(JsonNode dataNode) {
        if (dataNode == null || dataNode.isNull()) {
            return 0;
        }
        if (dataNode.isArray() || dataNode.isObject()) {
            return dataNode.size();
        }
        return 1;
    }

    private String normalizeKey(String rawKey) {
        return rawKey == null ? "" : rawKey.trim().toLowerCase(Locale.ROOT);
    }

    private List<String> resolveResourceNames(List<String> requestedNames) {
        List<String> source = (requestedNames == null || requestedNames.isEmpty()) ? DEFAULT_SALES_RESOURCE_NAMES : requestedNames;
        Set<String> seen = new LinkedHashSet<>();
        List<String> resolved = new ArrayList<>();

        for (String name : source) {
            if (name == null) {
                continue;
            }
            String trimmed = name.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            String normalized = normalizeKey(trimmed);
            String compact = normalized.replace(" ", "");
            if ("inertmaterial".equals(compact) || "inertmaterials".equals(compact)) {
                continue;
            }
            if (seen.add(normalized)) {
                resolved.add(trimmed);
            }
        }
        return resolved;
    }

    private String canonicalResourceName(String rawName) {
        String normalized = normalizeKey(rawName).replace(" ", "");
        String alias = RESOURCE_ALIASES.get(normalized);
        return alias != null ? alias : rawName;
    }

    private String normalizeVehicleName(String rawName) {
        String trimmed = rawName == null ? "" : rawName.trim();
        if (trimmed.isBlank()) {
            return "";
        }
        String alias = VEHICLE_NAME_ALIASES.get(normalizeKey(trimmed));
        return alias != null ? alias : trimmed;
    }

    private String emptyToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private JsonNode extractArrayPayload(Optional<UexDatasetCache> cache) {
        if (cache.isEmpty()) {
            return objectMapper.createArrayNode();
        }
        JsonNode payload = cache.get().getPayload();
        if (payload == null || !payload.isArray()) {
            return objectMapper.createArrayNode();
        }
        return payload;
    }

    private OffsetDateTime extractFetchedAt(Optional<UexDatasetCache> cache) {
        return cache.map(UexDatasetCache::getFetchedAt).orElse(null);
    }

    private String buildSourceUrl(String endpointPath) {
        String baseUrl = uexProperties.getBaseUrl();
        String normalizedBase = baseUrl == null ? "" : baseUrl.trim();
        if (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        return normalizedBase + endpointPath;
    }

    private record PreviewResult(JsonNode node, int previewItemCount, boolean truncated) {
    }

    private record BestSellPrice(int value, String terminal) {
    }
}
