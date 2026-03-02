package com.icy.icy_backend.service.news;

import com.icy.icy_backend.controller.dto.news.CigFeedResponseDTO;
import com.icy.icy_backend.controller.dto.news.CigRawEntryDTO;
import com.icy.icy_backend.controller.dto.news.CigSourceFetchErrorDTO;
import com.icy.icy_backend.controller.dto.news.CigWatchSourceDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.news.CigWatchEntry;
import com.icy.icy_backend.db.entity.news.CigWatchFetchError;
import com.icy.icy_backend.db.entity.news.CigSourceKind;
import com.icy.icy_backend.db.repository.news.CigWatchEntryRepository;
import com.icy.icy_backend.db.repository.news.CigWatchFetchErrorRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import jakarta.annotation.PostConstruct;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CigWatchService {
    private static final Logger logger = LoggerFactory.getLogger(CigWatchService.class);
    private static final String RSI_BASE_URL = "https://robertsspaceindustries.com";
    private static final DateTimeFormatter LEGACY_CREATED_AT_FORMATTER = DateTimeFormatter.ofPattern("EEE MMM dd HH:mm:ss Z yyyy", Locale.ENGLISH);
    private static final int DEFAULT_LIMIT = 40;
    private static final int MAX_LIMIT = 200;
    private static final int MAX_ENTRIES_PER_SOURCE_REFRESH = 5;
    private static final int MAX_RAW_LENGTH = 4000;
    private static final int MAX_EXCERPT_LENGTH = 600;
    private static final int SCHEDULE_INTERVAL_MINUTES = 5;

    private static final Pattern COMM_LINK_BLOCK_PATTERN = Pattern.compile(
            "<a[^>]*href=\"(?<href>/comm-link/transmission/\\d+[^\"]*)\"[^>]*>(?<block>[\\s\\S]*?)</a>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern COMM_LINK_TITLE_PATTERN = Pattern.compile(
            "<div\\s+class=\"title[^\"]*\">(?<title>[\\s\\S]*?)</div>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern COMM_LINK_TYPE_PATTERN = Pattern.compile(
            "<div\\s+class=\"type\\s+(?<type>[^\"]+)\"",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern COMM_LINK_ID_PATTERN = Pattern.compile("/comm-link/transmission/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RELATIVE_TIME_PATTERN = Pattern.compile(
            "(\\d+)\\s+(minute|hour|day|week|month|year)s?\\s+ago",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern TRAILING_NUMBER_PATTERN = Pattern.compile("(\\d+)(?!.*\\d)");
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final OffsetDateTime HARDCODED_SOURCE_TIMESTAMP = OffsetDateTime.parse("2026-02-27T00:00:00Z");
    private static final List<WatchSource> WATCHED_SOURCES = List.of(
            new WatchSource(
                    1L,
                    "RSI Comm-Link",
                    "https://robertsspaceindustries.com/comm-link/rss",
                    CigSourceKind.RSS,
                    true
            ),
            new WatchSource(
                    2L,
                    "RSI Devtracker",
                    "https://robertsspaceindustries.com/en/community/devtracker",
                    CigSourceKind.DEVTRACKER,
                    true
            )
    );

    private final MessageService messageService;
    private final CigWatchEntryRepository cigWatchEntryRepository;
    private final CigWatchFetchErrorRepository cigWatchFetchErrorRepository;
    private final CigWatchTranslationService cigWatchTranslationService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ReentrantLock refreshLock = new ReentrantLock();

    public CigWatchService(
            MessageService messageService,
            CigWatchEntryRepository cigWatchEntryRepository,
            CigWatchFetchErrorRepository cigWatchFetchErrorRepository,
            CigWatchTranslationService cigWatchTranslationService
    ) {
        this.messageService = messageService;
        this.cigWatchEntryRepository = cigWatchEntryRepository;
        this.cigWatchFetchErrorRepository = cigWatchFetchErrorRepository;
        this.cigWatchTranslationService = cigWatchTranslationService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<CigWatchSourceDTO>>> listSources() {
        List<CigWatchSourceDTO> sources = WATCHED_SOURCES.stream()
                .filter(WatchSource::getEnabled)
                .sorted((left, right) -> left.getLabel().compareToIgnoreCase(right.getLabel()))
                .map(this::toSourceDto)
                .toList();
        return messageService.buildResponse("cig.sources.list", sources, sources.size());
    }

    @PostConstruct
    public void bootstrapInitialFetch() {
        Thread bootstrapThread = new Thread(() -> {
            try {
                refreshCigFeedSafely();
            } catch (Exception ex) {
                logger.warn("Refresh bootstrap CIG ignore (contexte redemarrage/devtools): {}", ex.getMessage());
            }
        }, "cig-watch-bootstrap-refresh");
        bootstrapThread.setDaemon(true);
        bootstrapThread.start();
    }

    @Scheduled(cron = "0 */5 * * * *", zone = "UTC")
    public void scheduledRefresh() {
        refreshCigFeedSafely();
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> loadLatestFeed(Integer requestedLimit) {
        CigFeedResponseDTO response = buildFeedResponse(sanitizeLimit(requestedLimit));
        return messageService.buildResponse("cig.feed.get", response, response.itemCount(), response.errors().size());
    }

    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> forceRefreshAndLoadFeed(Integer requestedLimit) {
        refreshCigFeedSafely();
        CigFeedResponseDTO response = buildFeedResponse(sanitizeLimit(requestedLimit));
        return messageService.buildResponse("cig.feed.get", response, response.itemCount(), response.errors().size());
    }

    private void refreshCigFeedSafely() {
        refreshLock.lock();
        try {
            refreshCigFeed();
        } finally {
            refreshLock.unlock();
        }
    }

    @Transactional
    protected void refreshCigFeed() {
        List<WatchSource> sources = WATCHED_SOURCES.stream()
                .filter(WatchSource::getEnabled)
                .sorted((left, right) -> left.getLabel().compareToIgnoreCase(right.getLabel()))
                .toList();
        List<CigRawEntryDTO> entries = new ArrayList<>();
        List<CigSourceFetchErrorDTO> errors = new ArrayList<>();

        for (WatchSource source : sources) {
            try {
                String payload = fetchPayload(source.getSourceUrl());
                List<CigRawEntryDTO> sourceEntries = parseEntries(source, payload).stream()
                        .sorted(this::compareEntriesDesc)
                        .limit(MAX_ENTRIES_PER_SOURCE_REFRESH)
                        .toList();
                entries.addAll(sourceEntries);
            } catch (Exception ex) {
                errors.add(new CigSourceFetchErrorDTO(
                        source.getId(),
                        source.getLabel(),
                        source.getSourceUrl(),
                        sanitizeErrorMessage(ex.getMessage())
                ));
            }
        }

        persistEntries(entries);
        replacePersistedErrors(errors);
    }

    @Transactional(readOnly = true)
    protected CigFeedResponseDTO buildFeedResponse(int limit) {
        int normalizedLimit = sanitizeLimit(limit);
        List<WatchSource> sources = WATCHED_SOURCES.stream()
                .filter(WatchSource::getEnabled)
                .sorted((left, right) -> left.getLabel().compareToIgnoreCase(right.getLabel()))
                .toList();
        List<CigRawEntryDTO> entries = new ArrayList<>(loadPersistedEntries(normalizedLimit));
        List<CigSourceFetchErrorDTO> errors = loadPersistedErrors();

        entries.sort(this::compareEntriesDesc);

        CigFeedResponseDTO response = new CigFeedResponseDTO(
                findLatestFetchAt().orElse(null),
                computeNextScheduledFetchAt(OffsetDateTime.now(ZoneOffset.UTC)),
                sources.size(),
                entries.size(),
                entries,
                errors
        );

        return response;
    }

    private void persistEntries(List<CigRawEntryDTO> entries) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        for (CigRawEntryDTO dto : entries) {
            if (dto == null || dto.sourceId() == null || dto.link() == null || dto.link().isBlank()) {
                continue;
            }

            Optional<CigWatchEntry> existingOpt = cigWatchEntryRepository.findBySourceIdAndLink(dto.sourceId(), dto.link());
            CigWatchEntry existing = existingOpt.orElse(null);
            String title = trimToLength(firstNonBlank(dto.title(), "Entree CIG"), 300);
            String rawExcerpt = dto.rawExcerpt();
            String rawPayload = dto.rawPayload();
            boolean shouldTranslate = existing == null
                    || !nullToEmpty(existing.getTitle()).equals(nullToEmpty(title))
                    || !nullToEmpty(existing.getRawExcerpt()).equals(nullToEmpty(rawExcerpt))
                    || !nullToEmpty(existing.getRawPayload()).equals(nullToEmpty(rawPayload))
                    || existing.getTitleFr() == null
                    || existing.getRawExcerptFr() == null
                    || existing.getRawPayloadFr() == null;

            CigWatchTranslationService.TranslationResult translated = shouldTranslate
                    ? cigWatchTranslationService.translateToFrench(title, rawExcerpt, rawPayload)
                    : new CigWatchTranslationService.TranslationResult(
                    firstNonBlank(existing.getTitleFr(), title),
                    firstNonBlank(existing.getRawExcerptFr(), rawExcerpt),
                    firstNonBlank(existing.getRawPayloadFr(), rawPayload)
            );

            cigWatchEntryRepository.upsertEntry(
                    dto.sourceId(),
                    trimToLength(firstNonBlank(dto.sourceLabel(), "source"), 150),
                    firstNonBlank(dto.sourceUrl(), ""),
                    trimToLength(dto.externalId(), 255),
                    title,
                    trimToLength(translated.titleFr(), 300),
                    dto.link(),
                    trimToLength(firstNonBlank(dto.entryType(), "raw"), 120),
                    dto.publishedAt(),
                    dto.rankHint(),
                    rawExcerpt,
                    translated.excerptFr(),
                    rawPayload,
                    translated.payloadFr(),
                    dto.fetchedAt() == null ? now : dto.fetchedAt(),
                    existing == null || existing.getCreatedAt() == null ? now : existing.getCreatedAt(),
                    now
            );
        }
    }

    private void replacePersistedErrors(List<CigSourceFetchErrorDTO> errors) {
        cigWatchFetchErrorRepository.deleteAllInBatch();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (errors == null || errors.isEmpty()) {
            return;
        }
        List<CigWatchFetchError> entities = errors.stream()
                .filter(error -> error != null && error.sourceId() != null)
                .map(error -> CigWatchFetchError.builder()
                        .sourceId(error.sourceId())
                        .sourceLabel(trimToLength(firstNonBlank(error.sourceLabel(), "source"), 150))
                        .sourceUrl(firstNonBlank(error.sourceUrl(), ""))
                        .message(trimToLength(firstNonBlank(error.message(), "Erreur de recuperation de la source"), 220))
                        .fetchedAt(now)
                        .build())
                .toList();
        if (!entities.isEmpty()) {
            cigWatchFetchErrorRepository.saveAll(entities);
        }
    }

    private List<CigRawEntryDTO> loadPersistedEntries(int limit) {
        List<CigWatchEntry> entities = cigWatchEntryRepository.findByOrderByFetchedAtDesc(PageRequest.of(0, limit));
        return entities.stream()
                .map(entity -> new CigRawEntryDTO(
                        entity.getSourceId(),
                        entity.getSourceLabel(),
                        entity.getSourceUrl(),
                        entity.getExternalId(),
                        firstNonBlank(entity.getTitleFr(), entity.getTitle()),
                        entity.getLink(),
                        entity.getEntryType(),
                        entity.getPublishedAt(),
                        entity.getRankHint(),
                        firstNonBlank(entity.getRawExcerptFr(), entity.getRawExcerpt()),
                        firstNonBlank(entity.getRawPayloadFr(), entity.getRawPayload()),
                        entity.getFetchedAt()
                ))
                .sorted(this::compareEntriesDesc)
                .limit(limit)
                .toList();
    }

    private List<CigSourceFetchErrorDTO> loadPersistedErrors() {
        return cigWatchFetchErrorRepository.findAllByOrderBySourceLabelAsc().stream()
                .map(error -> new CigSourceFetchErrorDTO(
                        error.getSourceId(),
                        error.getSourceLabel(),
                        error.getSourceUrl(),
                        error.getMessage()
                ))
                .toList();
    }

    private Optional<OffsetDateTime> findLatestFetchAt() {
        Optional<OffsetDateTime> latestEntry = cigWatchEntryRepository.findFirstByOrderByFetchedAtDesc()
                .map(CigWatchEntry::getFetchedAt);
        Optional<OffsetDateTime> latestError = cigWatchFetchErrorRepository.findFirstByOrderByFetchedAtDesc()
                .map(CigWatchFetchError::getFetchedAt);
        OffsetDateTime left = latestEntry.orElse(null);
        OffsetDateTime right = latestError.orElse(null);
        if (left == null && right == null) {
            return Optional.empty();
        }
        if (left == null) {
            return Optional.of(right);
        }
        if (right == null) {
            return Optional.of(left);
        }
        return Optional.of(left.isAfter(right) ? left : right);
    }

    private OffsetDateTime computeNextScheduledFetchAt(OffsetDateTime nowUtc) {
        OffsetDateTime normalized = (nowUtc == null ? OffsetDateTime.now(ZoneOffset.UTC) : nowUtc)
                .withSecond(0)
                .withNano(0);
        int minute = normalized.getMinute();
        int delta = SCHEDULE_INTERVAL_MINUTES - (minute % SCHEDULE_INTERVAL_MINUTES);
        if (delta == 0) {
            delta = SCHEDULE_INTERVAL_MINUTES;
        }
        return normalized.plusMinutes(delta);
    }

    private CigWatchSourceDTO toSourceDto(WatchSource source) {
        return new CigWatchSourceDTO(
                source.getId(),
                source.getLabel(),
                source.getSourceUrl(),
                source.getSourceKind(),
                source.getEnabled(),
                HARDCODED_SOURCE_TIMESTAMP,
                HARDCODED_SOURCE_TIMESTAMP
        );
    }

    private List<CigRawEntryDTO> parseEntries(WatchSource source, String payload) throws Exception {
        CigSourceKind sourceKind = source.getSourceKind();
        if (sourceKind == null || sourceKind == CigSourceKind.COMM_LINK) {
            sourceKind = inferSourceKind(source.getSourceUrl());
        }
        return switch (sourceKind) {
            case RSS -> parseRss(source, payload);
            case DEVTRACKER -> parseDevtracker(source, payload);
            case X_PROFILE -> List.of();
            case COMM_LINK -> parseCommLink(source, payload);
        };
    }

    private List<CigRawEntryDTO> parseCommLink(WatchSource source, String html) {
        List<CigRawEntryDTO> jsoupEntries = parseCommLinkWithJsoup(source, html);
        if (!jsoupEntries.isEmpty()) {
            return jsoupEntries;
        }

        List<CigRawEntryDTO> entries = new ArrayList<>();
        Set<String> seenLinks = new LinkedHashSet<>();
        OffsetDateTime fetchedAt = OffsetDateTime.now(ZoneOffset.UTC);
        Matcher matcher = COMM_LINK_BLOCK_PATTERN.matcher(html);

        while (matcher.find()) {
            String href = matcher.group("href");
            if (href == null || href.isBlank()) {
                continue;
            }

            String link = absolutizeRsiUrl(href);
            if (!seenLinks.add(link)) {
                continue;
            }

            String block = matcher.group("block");
            String rawPayload = trimToLength(block, MAX_RAW_LENGTH);

            Long transmissionId = extractTransmissionId(href);
            String title = normalizeWhitespace(extractRegexGroup(COMM_LINK_TITLE_PATTERN, block));
            if (title == null || title.isBlank()) {
                title = transmissionId == null ? "Transmission CIG" : "Transmission " + transmissionId;
            }

            String entryType = normalizeWhitespace(extractRegexGroup(COMM_LINK_TYPE_PATTERN, block));
            String excerpt = buildExcerpt(rawPayload);

            entries.add(new CigRawEntryDTO(
                    source.getId(),
                    source.getLabel(),
                    source.getSourceUrl(),
                    transmissionId == null ? null : String.valueOf(transmissionId),
                    title,
                    link,
                    (entryType == null || entryType.isBlank()) ? "transmission" : entryType.toLowerCase(Locale.ROOT),
                    null,
                    transmissionId,
                    excerpt,
                    rawPayload,
                    fetchedAt
            ));
        }

        return entries;
    }

    private List<CigRawEntryDTO> parseCommLinkWithJsoup(WatchSource source, String html) {
        Document document = Jsoup.parse(html == null ? "" : html, source.getSourceUrl());
        List<CigRawEntryDTO> entries = new ArrayList<>();
        Set<String> seenLinks = new LinkedHashSet<>();
        OffsetDateTime fetchedAt = OffsetDateTime.now(ZoneOffset.UTC);

        for (Element anchor : document.select("a[href*=/comm-link/transmission/]")) {
            String href = normalizeWhitespace(anchor.attr("href"));
            if (href == null || href.isBlank()) {
                continue;
            }

            Long transmissionId = extractTransmissionId(href);
            if (transmissionId == null) {
                continue;
            }

            String link = absolutizeRsiUrl(href);
            if (!seenLinks.add(link)) {
                continue;
            }

            Element card = anchor.closest("article, li, .hub-grid-item, .comm-link-item, .transmission");
            String rawPayload = trimToLength(card == null ? anchor.outerHtml() : card.outerHtml(), MAX_RAW_LENGTH);

            String title = firstNonBlank(
                    selectNormalizedText(anchor, ".title"),
                    selectNormalizedText(card, ".title"),
                    normalizeWhitespace(anchor.attr("title")),
                    normalizeWhitespace(anchor.text())
            );
            if (title == null || title.isBlank()) {
                title = "Transmission " + transmissionId;
            }

            String category = firstNonBlank(
                    selectNormalizedText(anchor, ".type"),
                    selectNormalizedText(card, ".type"),
                    selectNormalizedText(card, ".category"),
                    "transmission"
            );
            String excerpt = buildExcerpt(card == null ? anchor.text() : card.text());

            entries.add(new CigRawEntryDTO(
                    source.getId(),
                    source.getLabel(),
                    source.getSourceUrl(),
                    String.valueOf(transmissionId),
                    title,
                    link,
                    category.toLowerCase(Locale.ROOT),
                    null,
                    transmissionId,
                    excerpt,
                    rawPayload,
                    fetchedAt
            ));
        }

        return entries;
    }

    private List<CigRawEntryDTO> parseDevtracker(WatchSource source, String html) {
        List<CigRawEntryDTO> entries = new ArrayList<>();
        Set<String> seenLinks = new LinkedHashSet<>();
        OffsetDateTime fetchedAt = OffsetDateTime.now(ZoneOffset.UTC);
        Document document = Jsoup.parse(html == null ? "" : html, source.getSourceUrl());

        for (Element postElement : document.select("a.devpost[href], a[href*=/spectrum/][class*=devpost]")) {
            String href = normalizeWhitespace(postElement.attr("href"));
            if (href == null || href.isBlank()) {
                continue;
            }

            String link = absolutizeRsiUrl(href);
            if (!seenLinks.add(link)) {
                continue;
            }

            String thread = selectNormalizedText(postElement, ".thread");
            String category = selectNormalizedText(postElement, ".category");
            String details = selectNormalizedText(postElement, ".details");
            String handle = selectNormalizedText(postElement, ".handle");
            String nickname = selectNormalizedText(postElement, ".nickname");
            String relativeTime = selectNormalizedText(postElement, ".time");

            String title = firstNonBlank(thread, "Devtracker post");
            String subtitle = firstNonBlank(handle, nickname);
            String entryType = category == null || category.isBlank() ? "devtracker" : ("devtracker:" + category.toLowerCase(Locale.ROOT));
            String rawPayload = trimToLength(buildDevtrackerRawPayload(title, category, subtitle, relativeTime, details), MAX_RAW_LENGTH);
            String excerpt = buildExcerpt(details);

            String externalId = extractTrailingIdAsString(href);
            Long rankHint = extractTrailingNumber(href);
            OffsetDateTime publishedAt = parseRelativeTime(relativeTime, fetchedAt);

            entries.add(new CigRawEntryDTO(
                    source.getId(),
                    source.getLabel(),
                    source.getSourceUrl(),
                    externalId,
                    title,
                    link,
                    entryType,
                    publishedAt,
                    rankHint,
                    excerpt,
                    rawPayload,
                    fetchedAt
            ));
        }

        return entries;
    }

    private String selectNormalizedText(Element parent, String cssQuery) {
        if (parent == null || cssQuery == null || cssQuery.isBlank()) {
            return null;
        }
        Element match = parent.selectFirst(cssQuery);
        if (match == null) {
            return null;
        }
        return decodeBasicHtmlEntities(normalizeWhitespace(match.text()));
    }

    private List<CigRawEntryDTO> parseRss(WatchSource source, String xmlPayload) throws Exception {
        if (looksLikeHtmlPayload(xmlPayload)) {
            return parseCommLink(source, xmlPayload);
        }

        try {
            org.w3c.dom.Document document = parseXml(xmlPayload);
            NodeList rssItems = document.getElementsByTagName("item");
            boolean atomFeed = rssItems.getLength() == 0;
            NodeList nodes = atomFeed ? document.getElementsByTagName("entry") : rssItems;
            List<CigRawEntryDTO> entries = new ArrayList<>();
            OffsetDateTime fetchedAt = OffsetDateTime.now(ZoneOffset.UTC);

            for (int i = 0; i < nodes.getLength(); i++) {
                Node node = nodes.item(i);
                if (!(node instanceof org.w3c.dom.Element element)) {
                    continue;
                }

                String title = firstNonBlank(extractElementText(element, "title"), "Entree RSS sans titre");
                String link = atomFeed ? extractAtomLink(element) : extractElementText(element, "link");
                if (link == null || link.isBlank()) {
                    link = source.getSourceUrl();
                }

                String publishedRaw = firstNonBlank(
                        extractElementText(element, "pubDate"),
                        extractElementText(element, "published"),
                        extractElementText(element, "updated"),
                        extractElementText(element, "dc:date")
                );
                OffsetDateTime publishedAt = parsePublishedAt(publishedRaw);

                String externalId = firstNonBlank(
                        extractElementText(element, "guid"),
                        extractElementText(element, "id"),
                        link
                );
                Long rankHint = extractTrailingNumber(externalId);

                String summary = firstNonBlank(
                        extractElementText(element, "description"),
                        extractElementText(element, "summary"),
                        extractElementText(element, "content:encoded"),
                        extractElementText(element, "content")
                );

                String excerpt = buildExcerpt(summary);
                String rawPayload = buildRssRawPayload(title, link, publishedRaw, externalId, summary);

                entries.add(new CigRawEntryDTO(
                        source.getId(),
                        source.getLabel(),
                        source.getSourceUrl(),
                        externalId,
                        title,
                        link,
                        atomFeed ? "atom" : "rss",
                        publishedAt,
                        rankHint,
                        excerpt,
                        rawPayload,
                        fetchedAt
                ));
            }

            if (!entries.isEmpty()) {
                return entries;
            }

            if (xmlPayload != null && xmlPayload.toLowerCase(Locale.ROOT).contains("<html")) {
                return parseCommLink(source, xmlPayload);
            }

            return entries;
        } catch (Exception ignored) {
            List<CigRawEntryDTO> jsoupRssEntries = parseRssWithJsoup(source, xmlPayload);
            if (!jsoupRssEntries.isEmpty()) {
                return jsoupRssEntries;
            }
            if (xmlPayload != null && xmlPayload.toLowerCase(Locale.ROOT).contains("<html")) {
                return parseCommLink(source, xmlPayload);
            }
            return jsoupRssEntries;
        }
    }

    private boolean looksLikeHtmlPayload(String payload) {
        if (payload == null) {
            return false;
        }
        String normalized = payload.stripLeading().toLowerCase(Locale.ROOT);
        return normalized.startsWith("<!doctype html")
                || normalized.startsWith("<html")
                || normalized.contains("<html");
    }

    private List<CigRawEntryDTO> parseRssWithJsoup(WatchSource source, String xmlPayload) {
        Document document = Jsoup.parse(xmlPayload == null ? "" : xmlPayload, source.getSourceUrl(), org.jsoup.parser.Parser.xmlParser());
        List<Element> rssItems = document.select("item");
        boolean atomFeed = rssItems.isEmpty();
        List<Element> nodes = atomFeed ? document.select("entry") : rssItems;
        List<CigRawEntryDTO> entries = new ArrayList<>();
        OffsetDateTime fetchedAt = OffsetDateTime.now(ZoneOffset.UTC);

        for (Element element : nodes) {
            String title = firstNonBlank(selectRssElementText(element, "title"), "Entree RSS sans titre");
            String link = atomFeed ? extractAtomLinkJsoup(element) : selectRssElementText(element, "link");
            if (link == null || link.isBlank()) {
                link = source.getSourceUrl();
            }

            String publishedRaw = firstNonBlank(
                    selectRssElementText(element, "pubDate"),
                    selectRssElementText(element, "published"),
                    selectRssElementText(element, "updated"),
                    selectRssElementText(element, "dc:date")
            );
            OffsetDateTime publishedAt = parsePublishedAt(publishedRaw);

            String externalId = firstNonBlank(
                    selectRssElementText(element, "guid"),
                    selectRssElementText(element, "id"),
                    link
            );
            Long rankHint = extractTrailingNumber(externalId);

            String summary = firstNonBlank(
                    selectRssElementText(element, "description"),
                    selectRssElementText(element, "summary"),
                    selectRssElementText(element, "content:encoded"),
                    selectRssElementText(element, "content")
            );

            String excerpt = buildExcerpt(summary);
            String rawPayload = buildRssRawPayload(title, link, publishedRaw, externalId, summary);

            entries.add(new CigRawEntryDTO(
                    source.getId(),
                    source.getLabel(),
                    source.getSourceUrl(),
                    externalId,
                    title,
                    link,
                    atomFeed ? "atom" : "rss",
                    publishedAt,
                    rankHint,
                    excerpt,
                    rawPayload,
                    fetchedAt
            ));
        }

        return entries;
    }

    private String selectRssElementText(Element parent, String tagName) {
        if (parent == null || tagName == null || tagName.isBlank()) {
            return null;
        }
        String cssName = tagName.replace(":", "\\:");
        Element exact = parent.selectFirst(cssName);
        if (exact != null) {
            return normalizeWhitespace(exact.text());
        }
        int colonIndex = tagName.indexOf(':');
        if (colonIndex > 0 && colonIndex < tagName.length() - 1) {
            String localName = tagName.substring(colonIndex + 1);
            Element local = parent.selectFirst(localName);
            if (local != null) {
                return normalizeWhitespace(local.text());
            }
        }
        return null;
    }

    private String extractAtomLinkJsoup(Element element) {
        for (Element linkElement : element.select("link")) {
            String href = normalizeWhitespace(linkElement.attr("href"));
            String rel = normalizeWhitespace(linkElement.attr("rel"));
            if (href != null && !href.isBlank() && (rel == null || rel.isBlank() || "alternate".equalsIgnoreCase(rel))) {
                return href;
            }
            String text = normalizeWhitespace(linkElement.text());
            if (text != null && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private String fetchPayload(String sourceUrl) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(
                MediaType.APPLICATION_XML,
                MediaType.TEXT_XML,
                MediaType.TEXT_HTML,
                MediaType.APPLICATION_JSON,
                MediaType.ALL
        ));
        headers.set(HttpHeaders.USER_AGENT, "IceForge-CIG-Watch/1.0");

        ResponseEntity<String> response = restTemplate.exchange(
                sourceUrl,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("HTTP " + response.getStatusCode().value() + " depuis la source");
        }
        if (response.getBody() == null || response.getBody().isBlank()) {
            throw new IllegalStateException("Reponse vide depuis la source");
        }
        return response.getBody();
    }

    private org.w3c.dom.Document parseXml(String xmlPayload) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        safeSetFeature(factory, "http://apache.org/xml/features/disallow-doctype-decl", false);
        safeSetFeature(factory, "http://xml.org/sax/features/external-general-entities", false);
        safeSetFeature(factory, "http://xml.org/sax/features/external-parameter-entities", false);
        safeSetFeature(factory, "http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        safeSetAttribute(factory, XMLConstants.ACCESS_EXTERNAL_DTD, "");
        safeSetAttribute(factory, XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");

        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(xmlPayload)));
    }

    private void safeSetFeature(DocumentBuilderFactory factory, String featureName, boolean value) {
        try {
            factory.setFeature(featureName, value);
        } catch (Exception ignored) {
            // Some XML parsers may not support all secure-processing flags.
        }
    }

    private void safeSetAttribute(DocumentBuilderFactory factory, String attributeName, String value) {
        try {
            factory.setAttribute(attributeName, value);
        } catch (Exception ignored) {
            // Some XML parsers may not support all secure-processing attributes.
        }
    }

    private String extractElementText(org.w3c.dom.Element element, String tagName) {
        NodeList directMatches = element.getElementsByTagName(tagName);
        if (directMatches.getLength() > 0) {
            return normalizeWhitespace(directMatches.item(0).getTextContent());
        }

        String localTagName = tagName.contains(":") ? tagName.substring(tagName.indexOf(':') + 1) : tagName;
        NodeList allChildren = element.getElementsByTagName("*");
        for (int i = 0; i < allChildren.getLength(); i++) {
            Node child = allChildren.item(i);
            if (!(child instanceof org.w3c.dom.Element childElement)) {
                continue;
            }

            String nodeName = childElement.getNodeName();
            String localName = childElement.getLocalName();
            if (tagName.equalsIgnoreCase(nodeName) || localTagName.equalsIgnoreCase(nodeName) || localTagName.equalsIgnoreCase(localName)) {
                return normalizeWhitespace(childElement.getTextContent());
            }
        }

        return null;
    }

    private String extractAtomLink(org.w3c.dom.Element element) {
        NodeList links = element.getElementsByTagName("link");
        for (int i = 0; i < links.getLength(); i++) {
            Node node = links.item(i);
            if (!(node instanceof org.w3c.dom.Element linkElement)) {
                continue;
            }

            String href = normalizeWhitespace(linkElement.getAttribute("href"));
            String rel = normalizeWhitespace(linkElement.getAttribute("rel"));
            if (href != null && !href.isBlank() && (rel == null || rel.isBlank() || "alternate".equalsIgnoreCase(rel))) {
                return href;
            }

            String text = normalizeWhitespace(linkElement.getTextContent());
            if (text != null && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private OffsetDateTime parsePublishedAt(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            return null;
        }

        try {
            return ZonedDateTime.parse(rawDate, DateTimeFormatter.RFC_1123_DATE_TIME).toOffsetDateTime();
        } catch (Exception ignored) {
        }

        try {
            return OffsetDateTime.parse(rawDate);
        } catch (Exception ignored) {
        }

        try {
            return ZonedDateTime.parse(rawDate, LEGACY_CREATED_AT_FORMATTER).toOffsetDateTime();
        } catch (Exception ignored) {
        }

        try {
            return Instant.parse(rawDate).atOffset(ZoneOffset.UTC);
        } catch (Exception ignored) {
        }

        return null;
    }

    private int compareEntriesDesc(CigRawEntryDTO left, CigRawEntryDTO right) {
        int byPublishedAt = compareByPublishedAt(left.publishedAt(), right.publishedAt());
        if (byPublishedAt != 0) {
            return byPublishedAt;
        }
        return Long.compare(valueOrZero(right.rankHint()), valueOrZero(left.rankHint()));
    }

    private int compareByPublishedAt(OffsetDateTime left, OffsetDateTime right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return 1;
        }
        if (right == null) {
            return -1;
        }
        return right.compareTo(left);
    }

    private long valueOrZero(Long value) {
        return value == null ? 0L : value;
    }

    private Long extractTransmissionId(String href) {
        if (href == null || href.isBlank()) {
            return null;
        }
        Matcher matcher = COMM_LINK_ID_PATTERN.matcher(href);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Long.parseLong(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Long extractTrailingNumber(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Matcher matcher = TRAILING_NUMBER_PATTERN.matcher(raw);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Long.parseLong(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String extractTrailingIdAsString(String raw) {
        Long value = extractTrailingNumber(raw);
        return value == null ? null : String.valueOf(value);
    }

    private OffsetDateTime parseRelativeTime(String relativeTime, OffsetDateTime referenceTime) {
        if (relativeTime == null || relativeTime.isBlank()) {
            return null;
        }
        Matcher matcher = RELATIVE_TIME_PATTERN.matcher(relativeTime.toLowerCase(Locale.ROOT));
        if (!matcher.find()) {
            return null;
        }

        long amount;
        try {
            amount = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException ex) {
            return null;
        }

        String unit = matcher.group(2);
        return switch (unit) {
            case "minute" -> referenceTime.minusMinutes(amount);
            case "hour" -> referenceTime.minusHours(amount);
            case "day" -> referenceTime.minusDays(amount);
            case "week" -> referenceTime.minusWeeks(amount);
            case "month" -> referenceTime.minusMonths(amount);
            case "year" -> referenceTime.minusYears(amount);
            default -> null;
        };
    }

    private String extractRegexGroup(Pattern pattern, String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        if (matcher.groupCount() < 1) {
            return null;
        }
        return matcher.group(1);
    }

    private String buildExcerpt(String rawPayload) {
        String clean = normalizeWhitespace(TAG_PATTERN.matcher(rawPayload == null ? "" : rawPayload).replaceAll(" "));
        if (clean == null || clean.isBlank()) {
            return null;
        }

        String decoded = decodeBasicHtmlEntities(clean);
        if (decoded.length() <= MAX_EXCERPT_LENGTH) {
            return decoded;
        }
        return decoded.substring(0, MAX_EXCERPT_LENGTH) + "...";
    }

    private String buildRssRawPayload(String title, String link, String published, String externalId, String summary) {
        String payload = """
                title: %s
                link: %s
                published: %s
                id: %s
                summary: %s
                """.formatted(
                nullToEmpty(title),
                nullToEmpty(link),
                nullToEmpty(published),
                nullToEmpty(externalId),
                nullToEmpty(summary)
        );
        return trimToLength(payload, MAX_RAW_LENGTH);
    }

    private String buildDevtrackerRawPayload(String title, String category, String author, String relativeTime, String details) {
        return """
                title: %s
                category: %s
                author: %s
                time: %s
                details: %s
                """.formatted(
                nullToEmpty(title),
                nullToEmpty(category),
                nullToEmpty(author),
                nullToEmpty(relativeTime),
                nullToEmpty(details)
        );
    }

    private String decodeBasicHtmlEntities(String value) {
        return value
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">");
    }

    private CigSourceKind inferSourceKind(String sourceUrl) {
        String normalized = sourceUrl.toLowerCase(Locale.ROOT);
        if (normalized.contains("/community/devtracker")) {
            return CigSourceKind.DEVTRACKER;
        }
        if (normalized.contains("rss") || normalized.endsWith(".xml") || normalized.contains("feed")) {
            return CigSourceKind.RSS;
        }
        return CigSourceKind.COMM_LINK;
    }

    private int sanitizeLimit(Integer requestedLimit) {
        if (requestedLimit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(MAX_LIMIT, requestedLimit));
    }

    private String sanitizeErrorMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Erreur de recuperation de la source";
        }
        return trimToLength(normalizeWhitespace(message), 220);
    }

    private String absolutizeRsiUrl(String link) {
        String normalized = normalizeWhitespace(link);
        if (normalized == null || normalized.isBlank()) {
            return RSI_BASE_URL;
        }
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return normalized;
        }
        if (normalized.startsWith("/")) {
            return RSI_BASE_URL + normalized;
        }
        return RSI_BASE_URL + "/" + normalized;
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String normalizeWhitespace(String value) {
        if (value == null) {
            return null;
        }
        return WHITESPACE_PATTERN.matcher(value).replaceAll(" ").trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static final class WatchSource {
        private final Long id;
        private final String label;
        private final String sourceUrl;
        private final CigSourceKind sourceKind;
        private final Boolean enabled;

        private WatchSource(Long id, String label, String sourceUrl, CigSourceKind sourceKind, Boolean enabled) {
            this.id = id;
            this.label = label;
            this.sourceUrl = sourceUrl;
            this.sourceKind = sourceKind;
            this.enabled = enabled;
        }

        private Long getId() {
            return id;
        }

        private String getLabel() {
            return label;
        }

        private String getSourceUrl() {
            return sourceUrl;
        }

        private CigSourceKind getSourceKind() {
            return sourceKind;
        }

        private Boolean getEnabled() {
            return Boolean.TRUE.equals(enabled);
        }
    }
}
