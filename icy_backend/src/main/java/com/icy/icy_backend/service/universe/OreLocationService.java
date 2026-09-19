package com.icy.icy_backend.service.universe;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.controller.dto.response.front.OreLocationUploadResultDTO;
import com.icy.icy_backend.controller.dto.response.front.OreMetricRangeDTO;
import com.icy.icy_backend.controller.dto.response.front.OreMixDTO;
import com.icy.icy_backend.db.entity.universe.OreLocation;
import com.icy.icy_backend.db.entity.universe.OreLocationOre;
import com.icy.icy_backend.db.repository.universe.OreLocationRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.catalog.CatalogOreDistributionService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class OreLocationService {
    private final OreLocationRepository oreLocationRepository;
    private final MessageService messageService;
    private final ObjectMapper objectMapper;
    private final CatalogOreDistributionService catalogOreDistributionService;

    public OreLocationService(
            OreLocationRepository oreLocationRepository,
            MessageService messageService,
            ObjectMapper objectMapper,
            CatalogOreDistributionService catalogOreDistributionService
    ) {
        this.oreLocationRepository = oreLocationRepository;
        this.messageService = messageService;
        this.objectMapper = objectMapper;
        this.catalogOreDistributionService = catalogOreDistributionService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OreLocationDTO>>> listLocations() {
        Map<String, OreLocationDTO> byLocation = new java.util.LinkedHashMap<>();
        java.util.Set<String> catalogCodes = new java.util.HashSet<>();
        catalogOreDistributionService.listLocations().forEach(row -> {
            byLocation.put(row.locationKey(), row);
            catalogCodes.add(normalizeCode(row.locationCode()));
        });
        oreLocationRepository.findAllByOrderByLocationCodeAsc()
                .stream()
                .map(this::toDto)
                .filter(row -> !catalogCodes.contains(normalizeCode(row.locationCode())))
                .forEach(row -> byLocation.putIfAbsent(row.locationKey(), row));
        List<OreLocationDTO> rows = new ArrayList<>(byLocation.values());
        return messageService.buildResponse("ore.locations.list", rows, rows.size());
    }

    @Transactional
    public ResponseEntity<MessageResponse<OreLocationUploadResultDTO>> uploadAndReplace(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Fichier JSON manquant.");
        }

        JsonNode root = readRoot(file);
        if (root == null || !root.isObject()) {
            throw new BadRequestException("Le JSON doit etre un objet de locations.");
        }

        String sourceUrl = text(root, "source_url", "sourceUrl");
        String gameVersion = text(root, "game_version", "gameVersion");
        if (gameVersion != null && gameVersion.length() > 20) throw new BadRequestException("Version trop longue.");
        if (sourceUrl != null && !sourceUrl.matches("https?://[^\\s]+")) throw new BadRequestException("URL de source invalide.");
        JsonNode locationsNode = root.path("locations");
        if (root.has("locations")) {
            if (!locationsNode.isObject()) throw new BadRequestException("locations doit être un objet.");
            root = locationsNode;
        }

        List<OreLocation> parsedLocations = new ArrayList<>();
        int oreEntryCount = 0;

        Iterator<Map.Entry<String, JsonNode>> entries = root.fields();
        while (entries.hasNext()) {
            Map.Entry<String, JsonNode> entry = entries.next();
            String rawCode = entry.getKey();
            if (java.util.Set.of("source_url", "sourceUrl", "game_version", "gameVersion").contains(rawCode)) continue;
            JsonNode locationNode = entry.getValue();
            if (locationNode == null || !locationNode.isObject() || !locationNode.path("ores").isObject()) {
                throw new BadRequestException("Localisation invalide : " + rawCode);
            }

            String locationCode = normalizeCode(rawCode);
            if (locationCode == null || locationCode.length() > 120 || parsedLocations.stream().anyMatch(row -> row.getLocationCode().equals(locationCode))) {
                throw new BadRequestException("Code de localisation invalide ou dupliqué : " + rawCode);
            }

            for (String metric : List.of("clusterCount", "mass", "inst", "res")) {
                validateRange(locationNode, metric);
            }

            OreLocation location = new OreLocation();
            location.setLocationCode(locationCode);
            location.setSourceUrl(sourceUrl);
            location.setGameVersion(gameVersion);
            location.setUsersCount(readInt(locationNode, "users"));
            location.setScansCount(readInt(locationNode, "scans"));
            location.setClustersCount(readInt(locationNode, "clusters"));

            JsonNode clusterCountNode = locationNode.path("clusterCount");
            location.setClusterCountMin(readDouble(clusterCountNode, "min"));
            location.setClusterCountMax(readDouble(clusterCountNode, "max"));
            location.setClusterCountMed(readDouble(clusterCountNode, "med"));

            JsonNode massNode = locationNode.path("mass");
            location.setMassMin(readDouble(massNode, "min"));
            location.setMassMax(readDouble(massNode, "max"));
            location.setMassMed(readDouble(massNode, "med"));

            JsonNode instNode = locationNode.path("inst");
            location.setInstMin(readDouble(instNode, "min"));
            location.setInstMax(readDouble(instNode, "max"));
            location.setInstMed(readDouble(instNode, "med"));

            JsonNode resNode = locationNode.path("res");
            location.setResMin(readDouble(resNode, "min"));
            location.setResMax(readDouble(resNode, "max"));
            location.setResMed(readDouble(resNode, "med"));

            List<OreLocationOre> ores = new ArrayList<>();
            JsonNode oresNode = locationNode.path("ores");
            if (oresNode.isObject()) {
                Iterator<Map.Entry<String, JsonNode>> oreFields = oresNode.fields();
                while (oreFields.hasNext()) {
                    Map.Entry<String, JsonNode> oreEntry = oreFields.next();
                    String oreCode = normalizeCode(oreEntry.getKey());
                    if (oreCode == null) {
                        continue;
                    }
                    JsonNode oreNode = oreEntry.getValue();
                    if (!oreNode.isObject() || oreCode.length() > 80 || ores.stream().anyMatch(row -> row.getOreCode().equals(oreCode))) {
                        throw new BadRequestException("Minerai invalide ou dupliqué : " + oreCode);
                    }
                    OreLocationOre ore = new OreLocationOre();
                    ore.setOreLocation(location);
                    ore.setOreCode(oreCode);
                    ore.setProbability(readDouble(oreNode, "prob"));
                    ore.setMinPct(readDouble(oreNode, "minPct"));
                    ore.setMaxPct(readDouble(oreNode, "maxPct"));
                    ore.setMedPct(readDouble(oreNode, "medPct"));
                    for (Double fraction : new Double[] {ore.getProbability(), ore.getMinPct(), ore.getMaxPct(), ore.getMedPct()}) {
                        if (fraction != null && fraction > 1) throw new BadRequestException("Les proportions doivent être comprises entre 0 et 1.");
                    }
                    if ((ore.getMinPct() != null && ore.getMaxPct() != null && ore.getMinPct() > ore.getMaxPct())
                            || (ore.getMedPct() != null && ore.getMinPct() != null && ore.getMedPct() < ore.getMinPct())
                            || (ore.getMedPct() != null && ore.getMaxPct() != null && ore.getMedPct() > ore.getMaxPct())) {
                        throw new BadRequestException("Concentrations incohérentes pour " + oreCode);
                    }
                    ores.add(ore);
                    oreEntryCount++;
                }
            }
            location.setOres(ores);
            parsedLocations.add(location);
        }

        if (parsedLocations.isEmpty() || oreEntryCount == 0) {
            throw new BadRequestException("Import vide : les données existantes sont conservées.");
        }
        oreLocationRepository.deleteAllInBatch();
        if (!parsedLocations.isEmpty()) {
            oreLocationRepository.saveAll(parsedLocations);
        }

        OreLocationUploadResultDTO result = new OreLocationUploadResultDTO(parsedLocations.size(), oreEntryCount);
        return messageService.buildResponse("ore.locations.uploaded", result, parsedLocations.size(), oreEntryCount);
    }

    private JsonNode readRoot(MultipartFile file) {
        try {
            return objectMapper.readTree(file.getInputStream());
        } catch (IOException exception) {
            throw new BadRequestException("Impossible de parser le JSON: " + exception.getMessage());
        }
    }

    private OreLocationDTO toDto(OreLocation location) {
        List<OreMixDTO> ores = location.getOres() == null ? List.of() : location.getOres()
                .stream()
                .map(ore -> new OreMixDTO(
                        ore.getOreCode(),
                        ore.getProbability(),
                        ore.getMinPct(),
                        ore.getMaxPct(),
                        ore.getMedPct()
                ))
                .toList();

        return new OreLocationDTO(
                location.getId(),
                location.getLocationCode(),
                location.getSourceUrl(),
                location.getGameVersion(),
                location.getUpdatedAt(),
                location.getUsersCount(),
                location.getScansCount(),
                location.getClustersCount(),
                new OreMetricRangeDTO(location.getClusterCountMin(), location.getClusterCountMax(), location.getClusterCountMed()),
                new OreMetricRangeDTO(location.getMassMin(), location.getMassMax(), location.getMassMed()),
                new OreMetricRangeDTO(location.getInstMin(), location.getInstMax(), location.getInstMed()),
                new OreMetricRangeDTO(location.getResMin(), location.getResMax(), location.getResMed()),
                ores
        );
    }

    private Integer readInt(JsonNode source, String fieldName) {
        if (source == null || source.isMissingNode()) {
            return null;
        }
        JsonNode value = source.path(fieldName);
        if (value.isIntegralNumber() && value.canConvertToInt() && value.asInt() >= 0) {
            return value.asInt();
        }
        if (value.isMissingNode() || value.isNull()) return null;
        throw new BadRequestException("Nombre entier invalide : " + fieldName);
    }

    private Double readDouble(JsonNode source, String fieldName) {
        if (source == null || source.isMissingNode()) {
            return null;
        }
        JsonNode value = source.path(fieldName);
        if (value.isNumber() && Double.isFinite(value.asDouble()) && value.asDouble() >= 0) {
            return value.asDouble();
        }
        if (value.isMissingNode() || value.isNull()) return null;
        throw new BadRequestException("Valeur numérique invalide : " + fieldName);
    }

    private String normalizeCode(String rawCode) {
        if (rawCode == null) {
            return null;
        }
        String trimmed = rawCode.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.toUpperCase(Locale.ROOT);
    }

    private void validateRange(JsonNode location, String field) {
        JsonNode range = location.get(field);
        if (range == null || range.isNull()) return;
        if (!range.isObject()) throw new BadRequestException("Plage invalide : " + field);
        Double min = readDouble(range, "min");
        Double max = readDouble(range, "max");
        Double med = readDouble(range, "med");
        if ((min != null && max != null && min > max)
                || (med != null && min != null && med < min)
                || (med != null && max != null && med > max)) {
            throw new BadRequestException("Plage incohérente : " + field);
        }
    }

    private String text(JsonNode source, String... fields) {
        for (String field : fields) {
            String value = source.path(field).asText("").trim();
            if (!value.isEmpty()) return value;
        }
        return null;
    }
}
