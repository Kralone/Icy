package com.icy.icy_backend.service.news;

import com.icy.icy_backend.db.entity.news.CigWatchEntry;
import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.entity.news.NewsType;
import com.icy.icy_backend.db.repository.news.CigWatchEntryRepository;
import com.icy.icy_backend.db.repository.news.NewsRepository;
import com.icy.icy_backend.db.repository.news.NewsTypeRepository;
import com.icy.icy_backend.messaging.NewsMessagingService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.OffsetDateTime;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CigWatchPublicationServiceTest {
    final CigWatchEntryRepository entries = mock(CigWatchEntryRepository.class);
    final NewsRepository news = mock(NewsRepository.class);
    final NewsTypeRepository types = mock(NewsTypeRepository.class);
    final CigWatchTranslationService translation = mock(CigWatchTranslationService.class);
    final NewsMessagingService messaging = mock(NewsMessagingService.class);
    final OffsetDateTime now = OffsetDateTime.parse("2026-09-10T12:00:00Z");

    CigWatchPublicationService service(boolean discord) {
        return new CigWatchPublicationService(entries, news, types, translation, messaging,
                mock(PlatformTransactionManager.class), true, discord);
    }
    CigWatchEntry entry(boolean eligible) {
        return CigWatchEntry.builder().id(1L).sourceId(1L).sourceLabel("RSI").link("https://robertsspaceindustries.com/comm-link/transmission/1")
                .title("Mining update").rawExcerpt("New mining changes").rawPayload("Mining details")
                .fetchedAt(now).createdAt(now).autoPublish(eligible).build();
    }
    void translated() {
        doReturn(new CigWatchTranslationService.TranslationResult("Le minage évolue", "Modifications du minage", "Détails du minage"))
                .when(translation).translateToFrench(anyString(), anyString(), anyString());
        when(types.findByName("CIG Watch")).thenReturn(Optional.of(NewsType.builder().id(1L).name("CIG Watch").color("#67e8f9").build()));
        when(news.saveAndFlush(any())).thenAnswer(invocation -> { News saved = invocation.getArgument(0); saved.setId(20L); return saved; });
    }
    @Test void untranslatedEntryIsRetriedWithoutPublishingEnglish() {
        var entry = entry(true);
        when(translation.translateToFrench(anyString(), anyString(), anyString())).thenThrow(new IllegalStateException("offline"));
        service(false).processEntry(entry, now);
        assertThat(entry.getTranslationStatus()).isEqualTo("FAILED");
        assertThat(entry.getTitleFr()).isNull();
        assertThat(entry.getNextRetryAt()).isAfter(now);
        verifyNoInteractions(news, messaging);
        translated();
        service(false).processEntry(entry, entry.getNextRetryAt());
        assertThat(entry.getTranslationStatus()).isEqualTo("TRANSLATED");
        assertThat(entry.getNewsId()).isEqualTo(20L);
    }
    @Test void archivesBacklogAndPublishesFreshEntryOnlyOnce() {
        translated();
        var archived = entry(false);
        service(false).processEntry(archived, now);
        verify(news, never()).saveAndFlush(any());
        var fresh = entry(true);
        var pipeline = service(false);
        pipeline.processEntry(fresh, now);
        pipeline.processEntry(fresh, now.plusMinutes(5));
        verify(news, times(1)).saveAndFlush(argThat(item -> item.getTitle().equals("Le minage évolue") && item.getContent().contains("Source : RSI")));
        verifyNoInteractions(messaging);
        assertThat(fresh.isAutoPublish()).isFalse();
    }
    @Test void doesNotAnnounceAnEligibleEntryAfterALongOutage() {
        translated();
        var old = entry(true);
        old.setFetchedAt(now.minusDays(2));
        service(false).processEntry(old, now);
        assertThat(old.isAutoPublish()).isFalse();
        verify(news, never()).saveAndFlush(any());
    }
    @Test void relayUsesStableNewsIdAndWaitsForDiscordConfirmation() {
        var entry = entry(false); entry.setNewsId(20L);
        News published = News.builder().id(20L).createdAt(now.toLocalDateTime()).build();
        when(news.findById(20L)).thenReturn(Optional.of(published));
        var pipeline = service(true);
        pipeline.relay(entry, now);
        pipeline.relay(entry, now.plusMinutes(1));
        verify(messaging, times(1)).sendCigNewsCreated(eq(published), anyLong());
        assertThat(entry.getDeliveryStatus()).isEqualTo("PENDING");
        published.setDiscordMessageId(300L); published.setDiscordChannelId(400L);
        pipeline.relay(entry, entry.getDeliveryRetryAt());
        assertThat(entry.getDeliveryStatus()).isEqualTo("DELIVERED");
        verify(messaging, times(1)).sendCigNewsCreated(eq(published), anyLong());
    }

    @Test void storesTheSanitizedAuthenticationActionForTheAdmin() {
        var entry = entry(true);
        when(translation.translateToFrench(anyString(), anyString(), anyString())).thenThrow(
                new CigWatchTranslationService.TranslationException(CigWatchTranslationService.FailureCode.ACCESS_DENIED));
        service(false).processEntry(entry, now);
        assertThat(entry.getLastError()).contains("401/403", "LibreTranslate");
        assertThat(entry.getTranslationStatus()).isEqualTo("FAILED");
        verifyNoInteractions(news, messaging);
    }

    @Test void enablingRelayDoesNotSendOldSiteNews() {
        var entry = entry(false); entry.setNewsId(20L);
        when(news.findById(20L)).thenReturn(Optional.of(News.builder().id(20L).createdAt(now.minusDays(2).toLocalDateTime()).build()));
        service(true).relay(entry, now);
        assertThat(entry.getDeliveryStatus()).isEqualTo("EXPIRED");
        verifyNoInteractions(messaging);
    }

    @Test void publishedNewsKeepsTheSourceArticleImage() {
        translated();
        var entry = entry(true);
        entry.setRawPayload("<div class='background' style=\"background-image:url('https://media.robertsspaceindustries.com/article.png')\"></div>");
        service(false).processEntry(entry, now);
        verify(news).saveAndFlush(argThat(item -> "https://media.robertsspaceindustries.com/article.png".equals(item.getImageUrl())));
    }
    @Test void adminCannotPublishHistoricalBacklog() {
        var old = entry(false);
        old.setFetchedAt(OffsetDateTime.now().minusDays(2));
        old.setTranslationStatus("TRANSLATED");
        when(entries.findForProcessing(1L)).thenReturn(Optional.of(old));
        assertThatThrownBy(() -> service(true).requestAction(1L, true))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verifyNoInteractions(news, messaging);
    }

    @Test void adminRepeatedPublicationDoesNotCreateOrRelayAgain() {
        var published = entry(false);
        published.setNewsId(20L);
        when(entries.findForProcessing(1L)).thenReturn(Optional.of(published));
        service(true).requestAction(1L, true);
        service(true).requestAction(1L, true);
        verifyNoInteractions(news, messaging, translation);
    }
    @Test void correctingFrenchStopsAutomaticPublicationUntilExplicitApproval() {
        var draft = entry(true);
        when(entries.findForProcessing(1L)).thenReturn(Optional.of(draft));
        service(true).correctTranslation(1L, "Refonte de Spectrum", "La deuxième phase est disponible.");
        assertThat(draft.getTitleFr()).isEqualTo("Refonte de Spectrum");
        assertThat(draft.getTranslationStatus()).isEqualTo("TRANSLATED");
        assertThat(draft.isAutoPublish()).isFalse();
        verifyNoInteractions(news, messaging, translation);
    }

    @Test void publishedFrenchCannotBeEditedThroughTheDraftEndpoint() {
        var published = entry(false);
        published.setNewsId(20L);
        when(entries.findForProcessing(1L)).thenReturn(Optional.of(published));
        assertThatThrownBy(() -> service(true).correctTranslation(1L, "Titre", "Contenu"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verify(entries, never()).save(any());
    }
}
