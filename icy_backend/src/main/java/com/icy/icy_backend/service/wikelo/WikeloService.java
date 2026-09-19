package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.config.WikeloProperties;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class WikeloService {
    private static final Logger logger = LoggerFactory.getLogger(WikeloService.class);
    private static final Pattern COST_PATTERN = Pattern.compile("Cost:\\s*(.*?)(?=Reputation:|Mission:|$)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern REPUTATION_PATTERN = Pattern.compile("Reputation:\\s*(.*?)(?=Cost:|Mission:|$)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final WikeloShipRepository wikeloShipRepository;
    private final WikeloProperties wikeloProperties;
    private final MessageService messageService;
    private final RestTemplate restTemplate = new RestTemplate();

    public WikeloService(
            WikeloShipRepository wikeloShipRepository,
            WikeloProperties wikeloProperties,
            MessageService messageService
    ) {
        this.wikeloShipRepository = wikeloShipRepository;
        this.wikeloProperties = wikeloProperties;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<WikeloShip>>> getShips() {
        List<WikeloShip> ships = wikeloShipRepository.findAllByOrderByShipNameAsc();
        return messageService.buildResponse("wikelo.ships.found", ships);
    }

    @Transactional
    public ResponseEntity<MessageResponse<List<WikeloShip>>> rescrapeShips() {
        List<WikeloShip> scrapedShips = scrapeShips();
        List<WikeloShip> savedShips = publishScrapedShips(scrapedShips);
        return messageService.buildResponse("wikelo.ships.scraped", savedShips, savedShips.size());
    }

    @Transactional
    public List<WikeloShip> publishScrapedShips(List<WikeloShip> scrapedShips) {
        if (scrapedShips.isEmpty()) {
            throw new IllegalStateException(
                    "Le rescrape Wikelo n'a retourne aucune offre; les donnees publiees sont conservees."
            );
        }
        wikeloShipRepository.deleteAllInBatch();
        List<WikeloShip> savedShips = wikeloShipRepository.saveAll(scrapedShips);
        savedShips.sort(Comparator.comparing(WikeloShip::getShipName, String.CASE_INSENSITIVE_ORDER));
        return savedShips;
    }

    public List<WikeloShip> scrapeShips() {
        return scrapeShipsFromGoogleSheets();
    }

    private List<WikeloShip> scrapeShipsFromGoogleSheets() {
        String csvUrl = buildCsvUrl();
        logger.info("Wikelo scrape depuis {}", csvUrl);

        String csvContent = fetchCsv(csvUrl);
        if (csvContent == null || csvContent.isBlank()) {
            logger.warn("Le contenu CSV Wikelo est vide");
            return List.of();
        }

        List<List<String>> rows = parseCsv(csvContent);
        Map<String, WikeloShip> dedup = new LinkedHashMap<>();
        LocalDateTime now = LocalDateTime.now();

        for (int row = 0; row < rows.size(); row++) {
            List<String> current = rows.get(row);
            for (int col = 0; col < current.size(); col++) {
                String shipName = clean(current.get(col));
                if (!isShipHeaderCell(rows, row, col, shipName)) {
                    continue;
                }

                String missionText = extractMissionText(rows, row, col);
                String costText = extractByPattern(missionText, COST_PATTERN);
                String reputationText = extractByPattern(missionText, REPUTATION_PATTERN);
                if (costText != null && costText.toLowerCase(Locale.ROOT).contains("continued")) {
                    costText = costText.replaceFirst("(?is)\\s*Continued.*$", "").trim();
                    String continuation = extractCostContinuation(rows, row, shipName);
                    costText += " | " + continuation;
                }
                if (costText != null) costText = costText.replaceAll("\\s*\\R\\s*", " | ");
                String componentsText = extractComponentsText(rows, row, col);

                WikeloShip ship = new WikeloShip();
                ship.setShipName(shipName);
                ship.setMissionText(missionText);
                ship.setCostText(costText);
                ship.setReputationText(reputationText);
                ship.setComponentsText(componentsText);
                ship.setSourceSheet(resolveSourceSheetLabel());
                ship.setSourceUrl(csvUrl);
                ship.setScrapedAt(now);

                dedup.put(shipName.toLowerCase(Locale.ROOT), ship);
            }
        }

        return new ArrayList<>(dedup.values());
    }

    String fetchCsv(String csvUrl) {
        return restTemplate.getForObject(csvUrl, String.class);
    }

    private String buildCsvUrl() {
        String spreadsheetId = wikeloProperties.getSpreadsheetId();
        Long gid = wikeloProperties.getShipsGid();
        if (gid != null && gid > 0) {
            // Disable Google's inferred headers: it otherwise merges credit rows into ship names.
            return "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/gviz/tq?tqx=out:csv&headers=0&gid=" + gid;
        }

        String sheetName = wikeloProperties.getShipsSheetName();
        String encodedSheetName = UriUtils.encodePathSegment(sheetName, StandardCharsets.UTF_8);
        return "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/gviz/tq?tqx=out:csv&headers=0&sheet=" + encodedSheetName;
    }

    private List<List<String>> parseCsv(String csvContent) {
        try (
                StringReader reader = new StringReader(csvContent);
                CSVParser parser = CSVFormat.DEFAULT.builder().setIgnoreEmptyLines(false).build().parse(reader)
        ) {
            List<List<String>> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                List<String> cols = new ArrayList<>();
                record.forEach(cols::add);
                rows.add(cols);
            }
            return rows;
        } catch (IOException e) {
            throw new IllegalStateException("Erreur lors du parsing CSV Wikelo", e);
        }
    }

    private boolean isShipHeaderCell(List<List<String>> rows, int row, int col, String value) {
        if (value.isBlank()) { return false; }
        if (value.startsWith("Wikelo Sheet:")) return false;
        if (value.startsWith("Mission:")) return false;
        if (value.startsWith("Cost:")) return false;
        if (value.startsWith("Reputation:")) return false;
        if (value.equalsIgnoreCase("Component")) return false;
        if (value.endsWith(":")) return false;
        if (!value.matches(".*[A-Za-z].*")) return false;

        String marker = clean(getCell(rows, row, col + 1));
        String componentHeader = clean(getCell(rows, row, col + 2));
        return "#".equals(marker) && "Component".equalsIgnoreCase(componentHeader);
    }

    private String extractMissionText(List<List<String>> rows, int startRow, int col) {
        List<String> lines = new ArrayList<>();
        for (int row = startRow + 1; row < rows.size(); row++) {
            String value = clean(getCell(rows, row, col));
            if (value.isBlank()) continue;
            if (value.startsWith("Credit:")) continue;
            if (isShipHeaderCell(rows, row, col, value)) break;
            if (value.startsWith("Mission:") || value.startsWith("Cost:") || value.startsWith("Reputation:")) {
                lines.add(value);
            }
        }
        return String.join(" | ", lines);
    }

    private String extractComponentsText(List<List<String>> rows, int startRow, int col) {
        List<String> components = new ArrayList<>();
        // Do not impose a fixed number of rows here. PYAM/Executive ships can
        // list a long internal fit; stopping at fourteen rows silently drops
        // the last modules. The next ship header is the unambiguous boundary.
        for (int row = startRow + 1; row < rows.size(); row++) {

            String type = clean(getCell(rows, row, col));
            if (isShipHeaderCell(rows, row, col, type)) break;
            if (type.isBlank() || !type.endsWith(":")) continue;
            if (type.startsWith("Mission:")) continue;

            String quantity = clean(getCell(rows, row, col + 1));
            String component = clean(getCell(rows, row, col + 2));
            String clazz = clean(getCell(rows, row, col + 4));
            String grade = clean(getCell(rows, row, col + 5));
            if (component.isBlank()) continue;

            StringBuilder line = new StringBuilder(type);
            if (!quantity.isBlank()) line.append(" ").append(quantity);
            line.append(" ").append(component);
            if (!clazz.isBlank() || !grade.isBlank()) {
                line.append(" (");
                if (!clazz.isBlank()) line.append(clazz);
                if (!clazz.isBlank() && !grade.isBlank()) line.append(" ");
                if (!grade.isBlank()) line.append(grade);
                line.append(")");
            }
            components.add(line.toString().trim());
        }
        return String.join(" | ", components);
    }

    private String extractCostContinuation(List<List<String>> rows, int headerRow, String shipName) {
        // The sheet explicitly names the continuation beside the ship header.
        // Never collect arbitrary neighboring notes or an unrelated recipe.
        List<String> header = rows.get(headerRow);
        for (int col = 0; col < header.size(); col++) {
            String label = clean(header.get(col));
            Matcher match = Pattern.compile("^(.+?) Costs Continued:\\s*$", Pattern.CASE_INSENSITIVE).matcher(label);
            if (!match.matches()) continue;
            String namedShip = match.group(1);
            if (!shipName.equalsIgnoreCase(namedShip)
                    && !shipName.toLowerCase(Locale.ROOT).startsWith(namedShip.toLowerCase(Locale.ROOT) + "-")) continue;
            long matchingHeaders = java.util.stream.IntStream.range(0, header.size())
                    .filter(c -> isShipHeaderCell(rows, headerRow, c, clean(header.get(c))))
                    .mapToObj(c -> clean(header.get(c)).toLowerCase(Locale.ROOT))
                    .filter(name -> name.equals(namedShip.toLowerCase(Locale.ROOT))
                            || name.startsWith(namedShip.toLowerCase(Locale.ROOT) + "-")).count();
            if (matchingHeaders != 1) throw new IllegalStateException("Suite de recette Wikelo ambiguë : " + shipName);
            String continuation = clean(getCell(rows, headerRow + 1, col));
            if (!continuation.isBlank() && continuation.lines().allMatch(line -> line.trim().matches("[0-9]+x\\s+.+"))) {
                return continuation;
            }
        }
        throw new IllegalStateException("Suite de recette Wikelo absente ou invalide : " + shipName);
    }

    private String extractByPattern(String text, Pattern pattern) {
        if (text == null || text.isBlank()) return null;
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return clean(matcher.group(1)).replaceFirst("\\s*\\|\\s*$", "");
        }
        return null;
    }

    private String getCell(List<List<String>> rows, int row, int col) {
        if (row < 0 || row >= rows.size()) return "";
        List<String> current = rows.get(row);
        if (col < 0 || col >= current.size()) return "";
        return current.get(col);
    }

    private String clean(String value) {
        return value == null ? "" : value.replace("\u00A0", " ").trim();
    }

    private String resolveSourceSheetLabel() {
        Long gid = wikeloProperties.getShipsGid();
        if (gid != null && gid > 0) {
            return "gid=" + gid;
        }
        String sheetName = wikeloProperties.getShipsSheetName();
        return (sheetName == null || sheetName.isBlank()) ? "unknown" : sheetName;
    }
}
