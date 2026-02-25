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

    public OreLocationService(
            OreLocationRepository oreLocationRepository,
            MessageService messageService,
            ObjectMapper objectMapper
    ) {
        this.oreLocationRepository = oreLocationRepository;
        this.messageService = messageService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OreLocationDTO>>> listLocations() {
        List<OreLocationDTO> rows = oreLocationRepository.findAllByOrderByLocationCodeAsc()
                .stream()
                .map(this::toDto)
                .toList();
        return messageService.buildResponse("ore.locations.list", rows, rows.size());
    }

    @Transactional
    public ResponseEntity<MessageResponse<OreLocationUploadResultDTO>> uploadAndReplace(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Fichier JSON manquant.");
        }

        JsonNode root = readRoot(file);
        if (!root.isObject()) {
            throw new BadRequestException("Le JSON doit etre un objet de locations.");
        }

        List<OreLocation> parsedLocations = new ArrayList<>();
        int oreEntryCount = 0;

        Iterator<Map.Entry<String, JsonNode>> entries = root.fields();
        while (entries.hasNext()) {
            Map.Entry<String, JsonNode> entry = entries.next();
            String rawCode = entry.getKey();
            JsonNode locationNode = entry.getValue();
            if (locationNode == null || !locationNode.isObject()) {
                continue;
            }

            String locationCode = normalizeCode(rawCode);
            if (locationCode == null) {
                continue;
            }

            OreLocation location = new OreLocation();
            location.setLocationCode(locationCode);
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
                    OreLocationOre ore = new OreLocationOre();
                    ore.setOreLocation(location);
                    ore.setOreCode(oreCode);
                    ore.setProbability(readDouble(oreNode, "prob"));
                    ore.setMinPct(readDouble(oreNode, "minPct"));
                    ore.setMaxPct(readDouble(oreNode, "maxPct"));
                    ore.setMedPct(readDouble(oreNode, "medPct"));
                    ores.add(ore);
                    oreEntryCount++;
                }
            }
            location.setOres(ores);
            parsedLocations.add(location);
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
            return 0;
        }
        JsonNode value = source.path(fieldName);
        if (value.isNumber()) {
            return value.asInt();
        }
        return 0;
    }

    private Double readDouble(JsonNode source, String fieldName) {
        if (source == null || source.isMissingNode()) {
            return 0d;
        }
        JsonNode value = source.path(fieldName);
        if (value.isNumber()) {
            return value.asDouble();
        }
        return 0d;
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
}
