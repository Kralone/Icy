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
    void cigAnnouncementHasExpiryAndAcceptsMissingTypeImage() {
        MessagePublisher publisher = Mockito.mock(MessagePublisher.class);
        NewsMessagingService service = new NewsMessagingService(publisher);
        NewsType type = NewsType.builder().name("CIG Watch").color("#67e8f9").build();
        News news = News.builder().id(12L).title("Actualité CIG").content("Texte traduit").author("ICY-System").type(type).build();
        service.sendCigNewsCreated(news, 60000L);
        verify(publisher).publishExpiring(Mockito.anyString(), Mockito.eq("news.created"), Mockito.any(), Mockito.eq(60000L));
    }

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

    @Test void carriesArticleImageSeparatelyFromTypeFallback() {
        MessagePublisher publisher = Mockito.mock(MessagePublisher.class);
        NewsMessagingService service = new NewsMessagingService(publisher);
        NewsType type = NewsType.builder().name("CIG Watch").color("#67e8f9").imageUrl("https://example.test/type.png").build();
        News news = News.builder().id(12L).title("CIG").content("Texte").author("ICY").type(type)
                .imageUrl("https://media.robertsspaceindustries.com/article.jpg").build();
        service.sendCigNewsCreated(news, 60000L);
        verify(publisher).publishExpiring(Mockito.anyString(), Mockito.eq("news.created"),
                Mockito.argThat(payload -> "https://media.robertsspaceindustries.com/article.jpg".equals(((java.util.Map<?, ?>) payload).get("imageUrl"))), Mockito.eq(60000L));
    }
}
