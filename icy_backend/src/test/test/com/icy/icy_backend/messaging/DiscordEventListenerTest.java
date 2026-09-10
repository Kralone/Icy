package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.news.CigWatchEntryRepository;
import com.icy.icy_backend.db.repository.news.NewsRepository;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class DiscordEventListenerTest {
    @Test void validCallbackMarksOnlyTheLinkedCigNewsAsDelivered() {
        var newsRepository = mock(NewsRepository.class);
        var cigRepository = mock(CigWatchEntryRepository.class);
        var news = News.builder().id(12L).build();
        when(newsRepository.findById(12L)).thenReturn(Optional.of(news));
        var listener = new DiscordEventListener(newsRepository, mock(EventRepository.class), cigRepository);
        listener.onDiscordLinked(Map.of("newsId", 12L, "messageId", 34L, "channelId", 56L));
        assertThat(news.getDiscordMessageId()).isEqualTo(34L);
        verify(newsRepository).save(news);
        verify(cigRepository).markDeliveredByNewsId(12L);
    }

    @Test void invalidCallbackDoesNotMarkAnyEntryDelivered() {
        var newsRepository = mock(NewsRepository.class);
        var cigRepository = mock(CigWatchEntryRepository.class);
        var listener = new DiscordEventListener(newsRepository, mock(EventRepository.class), cigRepository);
        assertThatThrownBy(() -> listener.onDiscordLinked(Map.of("newsId", 12L, "messageId", 0L, "channelId", 56L)))
                .isInstanceOf(org.springframework.amqp.AmqpRejectAndDontRequeueException.class);
        verifyNoInteractions(newsRepository, cigRepository);
    }
    @Test void persistenceFailureIsNotAcknowledgedAsDelivered() {
        var newsRepository = mock(NewsRepository.class);
        var cigRepository = mock(CigWatchEntryRepository.class);
        when(newsRepository.findById(12L)).thenReturn(Optional.of(News.builder().id(12L).build()));
        when(newsRepository.save(any())).thenThrow(new IllegalStateException("database unavailable"));
        var listener = new DiscordEventListener(newsRepository, mock(EventRepository.class), cigRepository);
        assertThatThrownBy(() -> listener.onDiscordLinked(Map.of("newsId", 12L, "messageId", 34L, "channelId", 56L)))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(cigRepository);
    }
}
