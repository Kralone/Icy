package com.icy.icy_backend.service.news;

import com.icy.icy_backend.controller.dto.news.CigRawEntryDTO;
import com.icy.icy_backend.db.repository.news.CigWatchEntryRepository;
import com.icy.icy_backend.db.repository.news.CigWatchFetchErrorRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CigWatchServiceTest {
    @Test void rssHtmlFallbackReadsModernCommlinkCardsAndNormalizesEnglishPrefix() {
        var service = new CigWatchService(mock(MessageService.class), mock(CigWatchEntryRepository.class),
                mock(CigWatchFetchErrorRepository.class), mock(CigWatchTranslationService.class), mock(CigWatchPublicationService.class));
        List<?> sources = (List<?>) ReflectionTestUtils.getField(CigWatchService.class, "WATCHED_SOURCES");
        String html = """
                <!doctype html><html><body>
                <a class="hub-block" href="/en/comm-link/engineering/21314-Mining">
                  <div class="title">Mining update</div><div class="time_ago"><span class="value">2 hours ago</span></div>
                  <div class="body"><p>Refinery improvements.</p></div>
                </a></body></html>
                """;
        List<CigRawEntryDTO> parsed = ReflectionTestUtils.invokeMethod(service, "parseRss", sources.getFirst(), html);
        assertThat(parsed).hasSize(1);
        assertThat(parsed.getFirst().title()).isEqualTo("Mining update");
        assertThat(parsed.getFirst().link()).isEqualTo("https://robertsspaceindustries.com/comm-link/engineering/21314-Mining");
        assertThat(parsed.getFirst().rawExcerpt()).isEqualTo("Refinery improvements.");
        assertThat(parsed.getFirst().publishedAt()).isNotNull();
        service.stop();
    }
}
