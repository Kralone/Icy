package com.icy.icy_backend.service.news;

import com.icy.icy_backend.db.entity.news.CigWatchEntry;
import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.repository.news.CigWatchEntryRepository;
import com.icy.icy_backend.db.repository.news.NewsRepository;
import com.icy.icy_backend.db.repository.news.NewsTypeRepository;
import com.icy.icy_backend.messaging.NewsMessagingService;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Durable publication and delivery state; never treat an untranslated source as French. */
@Service
public class CigWatchPublicationService {
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(CigWatchPublicationService.class);
    private final CigWatchEntryRepository entries;
    private final NewsRepository news;
    private final NewsTypeRepository types;
    private final CigWatchTranslationService translation;
    private final NewsMessagingService messaging;
    private final TransactionTemplate transaction;
    private final boolean publishingEnabled;
    private final boolean discordRelayEnabled;

    public CigWatchPublicationService(CigWatchEntryRepository entries, NewsRepository news, NewsTypeRepository types,
            CigWatchTranslationService translation, NewsMessagingService messaging, PlatformTransactionManager manager,
            @Value("${cig.watch.publishing-enabled:true}") boolean publishingEnabled,
            @Value("${cig.watch.discord-enabled:false}") boolean discordRelayEnabled) {
        this.entries = entries;
        this.news = news;
        this.types = types;
        this.translation = translation;
        this.messaging = messaging;
        this.transaction = new TransactionTemplate(manager);
        this.publishingEnabled = publishingEnabled;
        this.discordRelayEnabled = discordRelayEnabled;
    }

    public boolean isPublishingEnabled() { return publishingEnabled; }
    public boolean isDiscordRelayEnabled() { return discordRelayEnabled; }

    public void correctTranslation(Long id, String title, String excerpt) {
        String cleanTitle = text(title);
        String cleanExcerpt = text(excerpt);
        if (cleanTitle.isBlank() || cleanTitle.length() > 150 || cleanExcerpt.isBlank() || cleanExcerpt.length() > 600) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Titre requis (150 caractères maximum), texte requis (600 caractères maximum).");
        }
        transaction.executeWithoutResult(status -> {
            var entry = entries.findForProcessing(id).orElseThrow(() ->
                    new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Entrée introuvable"));
            if (entry.getNewsId() != null) throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Modifiez cette actualité depuis les actualités du site.");
            entry.setTitleFr(cleanTitle);
            entry.setRawExcerptFr(cleanExcerpt);
            entry.setTranslationStatus("TRANSLATED");
            entry.setAutoPublish(false);
            entry.setLastError(null);
            entry.setNextRetryAt(null);
            entry.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            entries.save(entry);
        });
    }

    /** Explicit per-entry admin action; never reactivates the collected backlog. */
    public void requestAction(Long id, boolean publish) {
        transaction.executeWithoutResult(status -> {
            var entry = entries.findForProcessing(id).orElseThrow(() ->
                    new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Entrée introuvable"));
            var now = OffsetDateTime.now(ZoneOffset.UTC);
            if (publish) {
                if (entry.getNewsId() != null) return;
                if (!publishingEnabled || !"TRANSLATED".equals(entry.getTranslationStatus())
                        || entry.getFetchedAt().isBefore(now.minusHours(24))) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                            "Publication réservée aux entrées récentes traduites ; vérifiez la configuration.");
                }
                entry.setAutoPublish(true);
            }
            entry.setNextRetryAt(null);
            processEntry(entry, now);
            if (entry.getNewsId() != null && !"DELIVERED".equals(entry.getDeliveryStatus())
                    && !"EXPIRED".equals(entry.getDeliveryStatus())) {
                entry.setDeliveryRetryAt(null);
                if (discordRelayEnabled) entry.setDeliveryStatus("PENDING");
                relay(entry, now);
            }
        });
    }

    public void processPending() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        backfillImages();
        for (Long id : entries.findProcessingCandidates(now, PageRequest.of(0, 3))) {
            try {
                transaction.executeWithoutResult(status -> entries.findForProcessing(id).ifPresent(entry -> processEntry(entry, now)));
            } catch (Exception ex) { logger.warn("Traitement CIG #{} reporté ({})", id, ex.getClass().getSimpleName()); }
        }
        if (discordRelayEnabled) {
            for (Long id : entries.findDeliveryCandidates(now, PageRequest.of(0, 3))) {
                try {
                    transaction.executeWithoutResult(status -> entries.findForProcessing(id).ifPresent(entry -> relay(entry, now)));
                } catch (Exception ex) { logger.warn("Relais CIG #{} reporté ({})", id, ex.getClass().getSimpleName()); }
            }
        }
    }

    private void backfillImages() {
        // Enrich already-published local records only; do not republish or send Discord events.
        for (CigWatchEntry entry : entries.findImageCandidates(PageRequest.of(0, 50))) {
            String image = CigWatchImages.fromCard(entry.getRawPayload(), entry.getLink());
            if (image == null) continue;
            transaction.executeWithoutResult(status -> news.findById(entry.getNewsId()).ifPresent(item -> {
                if (item.getImageUrl() == null) {
                    item.setImageUrl(image);
                    news.save(item);
                }
            }));
        }
    }

    void processEntry(CigWatchEntry entry, OffsetDateTime now) {
        if (entry.getNextRetryAt() != null && entry.getNextRetryAt().isAfter(now)) return;
        // Recovery after a long outage must not announce yesterday's backlog.
        if (entry.isAutoPublish() && entry.getFetchedAt().isBefore(now.minusHours(24))) entry.setAutoPublish(false);
        try {
            if (!"TRANSLATED".equals(entry.getTranslationStatus())) {
                var result = translation.translateToFrench(entry.getTitle(), text(entry.getRawExcerpt()), text(entry.getRawPayload()));
                entry.setTitleFr(limit(result.titleFr(), 300));
                entry.setRawExcerptFr(result.excerptFr());
                entry.setRawPayloadFr(result.payloadFr());
                entry.setTranslationStatus("TRANSLATED");
            }
            if (publishingEnabled && entry.isAutoPublish() && entry.getNewsId() == null) {
                var type = types.findByName("CIG Watch").orElseThrow(() -> new IllegalStateException("Type CIG Watch absent"));
                String excerpt = limit(text(entry.getRawExcerptFr()), 600);
                if (excerpt.isBlank()) excerpt = limit(text(entry.getRawPayloadFr()), 600);
                if (excerpt.isBlank()) throw new IllegalStateException("Contenu traduit vide");
                if (entry.getLink() == null || !entry.getLink().startsWith("https://")) throw new IllegalStateException("Source HTTPS requise");
                News created = news.saveAndFlush(News.builder()
                        .title(limit(entry.getTitleFr(), 150))
                        .author("ICY-System")
                        .imageUrl(CigWatchImages.fromCard(entry.getRawPayload(), entry.getLink()))
                        .createdAt(now.toLocalDateTime())
                        .type(type)
                        .content("<p>" + HtmlUtils.htmlEscape(excerpt) + "</p><p><a href=\""
                                + HtmlUtils.htmlEscape(entry.getLink()) + "\">Source : "
                                + HtmlUtils.htmlEscape(entry.getSourceLabel()) + "</a></p>")
                        .build());
                entry.setNewsId(created.getId());
                // Prevent a manually deleted news item from being recreated.
                entry.setAutoPublish(false);
                entry.setDeliveryStatus(discordRelayEnabled ? "PENDING" : "DISABLED");
                entry.setDeliveryRetryAt(now);
            }
            entry.setLastError(null);
            entry.setProcessingAttempts(0);
            entry.setNextRetryAt(publishingEnabled || !entry.isAutoPublish() ? null : now.plusMinutes(30));
        } catch (Exception ex) {
            if (!"TRANSLATED".equals(entry.getTranslationStatus())) entry.setTranslationStatus("FAILED");
            entry.setProcessingAttempts(entry.getProcessingAttempts() + 1);
            entry.setLastError("TRANSLATED".equals(entry.getTranslationStatus())
                    ? "Publication indisponible. Nouvelle tentative programmée."
                    : ex instanceof CigWatchTranslationService.TranslationException ? ex.getMessage()
                    : "Traduction française indisponible. Vérifiez la configuration et le service de traduction.");
            entry.setNextRetryAt(now.plusMinutes(retryMinutes(entry.getProcessingAttempts())));
        }
        entry.setUpdatedAt(now);
        entries.save(entry);
    }

    void relay(CigWatchEntry entry, OffsetDateTime now) {
        if (!discordRelayEnabled || entry.getNewsId() == null || ("DELIVERED".equals(entry.getDeliveryStatus()) || "EXPIRED".equals(entry.getDeliveryStatus()))) return;
        if (entry.getDeliveryRetryAt() != null && entry.getDeliveryRetryAt().isAfter(now)) return;
        News published = news.findById(entry.getNewsId()).orElse(null);
        if (published == null) return;
        if (published.getDiscordMessageId() != null && published.getDiscordChannelId() != null) {
            entry.setDeliveryStatus("DELIVERED");
            entry.setDeliveryRetryAt(null);
            entry.setLastError(null);
        } else if (published.getCreatedAt().isBefore(now.minusHours(24).toLocalDateTime())) {
            entry.setDeliveryStatus("EXPIRED");
            entry.setDeliveryRetryAt(null);
            entry.setLastError("Annonce Discord expirée : aucun rattrapage des anciennes actualités.");
        } else {
            // A stable news id is reused by the bot's durable discord_link_store.
            // Do not claim delivery until news.discordLinked has updated the news row.
            entry.setDeliveryStatus("PENDING");
            try {
                long ttlMillis = java.time.Duration.between(now.toLocalDateTime(), published.getCreatedAt().plusHours(24)).toMillis();
                messaging.sendCigNewsCreated(published, Math.max(1, ttlMillis));
                entry.setLastError("Confirmation Discord en attente.");
            } catch (Exception ex) {
                entry.setLastError("Relais Discord indisponible. Nouvelle tentative programmée.");
            }
            entry.setDeliveryAttempts(entry.getDeliveryAttempts() + 1);
            entry.setDeliveryRetryAt(now.plusMinutes(Math.max(10, retryMinutes(entry.getDeliveryAttempts()))));
        }
        entry.setUpdatedAt(now);
        entries.save(entry);
    }

    private static long retryMinutes(int attempts) { return Math.min(360L, 5L * (1L << Math.min(7, Math.max(0, attempts - 1)))); }
    private static String text(String value) { return value == null ? "" : Jsoup.parse(value).text().trim(); }
    private static String limit(String value, int max) { return value == null ? "" : value.substring(0, Math.min(value.length(), max)); }
}
