package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.entity.news.NewsType;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class NewsMessagingServiceTest {

    @Test
    void sendNewsCreatedSkipsWhenTypeMissing() {
        MessagePublisher publisher = Mockito.mock(MessagePublisher.class);
        NewsMessagingService service = new NewsMessagingService(publisher);

        News news = new News();
        service.sendNewsCreated(news);
        verifyNoInteractions(publisher);
    }

    @Test
    void sendNewsDeletedPublishesWhenDiscordIdsPresent() {
        MessagePublisher publisher = Mockito.mock(MessagePublisher.class);
        NewsMessagingService service = new NewsMessagingService(publisher);

        NewsType type = new NewsType();
        type.setName("Type");

        News news = new News();
        news.setId(1L);
        news.setType(type);
        news.setCreatedAt(LocalDateTime.now());
        news.setDiscordChannelId(10L);
        news.setDiscordMessageId(20L);

        service.sendNewsDeleted(news);
        verify(publisher).publish(Mockito.anyString(), Mockito.anyString(), Mockito.any());
    }
}
