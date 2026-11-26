package com.icy.icy_backend.service.news;

import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.entity.news.NewsType;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.news.NewsRepository;
import com.icy.icy_backend.db.repository.news.NewsTypeRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.messaging.NewsMessagingService;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NewsServiceTest {

    @Test
    void createNewsSendsMessagingAndBroadcast() {
        NewsRepository newsRepository = Mockito.mock(NewsRepository.class);
        NewsTypeRepository typeRepository = Mockito.mock(NewsTypeRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        NewsMessagingService newsMessagingService = Mockito.mock(NewsMessagingService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        NewsService service = new NewsService(newsRepository, typeRepository, userService, newsMessagingService, notificationPushService);

        NewsType type = new NewsType();
        type.setId(1L);
        type.setName("Update");
        when(typeRepository.findById(1L)).thenReturn(Optional.of(type));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        when(userService.findUserById(userId)).thenReturn(user);

        News saved = new News();
        saved.setId(10L);
        saved.setTitle("Title");
        saved.setType(type);
        saved.setCreatedAt(LocalDateTime.now());
        when(newsRepository.save(any(News.class))).thenReturn(saved);

        try (MockedStatic<AuthUtils> mocked = Mockito.mockStatic(AuthUtils.class)) {
            mocked.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            News result = service.create(new News(), 1L);
            assertThat(result).isEqualTo(saved);
        }

        verify(newsMessagingService).sendNewsCreated(saved);
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }

    @Test
    void createTypeThrowsIfExists() {
        NewsRepository newsRepository = Mockito.mock(NewsRepository.class);
        NewsTypeRepository typeRepository = Mockito.mock(NewsTypeRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        NewsMessagingService newsMessagingService = Mockito.mock(NewsMessagingService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        NewsService service = new NewsService(newsRepository, typeRepository, userService, newsMessagingService, notificationPushService);

        NewsType type = new NewsType();
        type.setName("Update");
        when(typeRepository.findByNameIgnoreCase("Update")).thenReturn(Optional.of(new NewsType()));

        assertThatThrownBy(() -> service.createType(type))
                .isInstanceOf(ResourceAlreadyExistsException.class);
    }

    @Test
    void updateChangesImageAndPublishesTheUpdatedNews() {
        NewsRepository newsRepository = Mockito.mock(NewsRepository.class);
        NewsTypeRepository typeRepository = Mockito.mock(NewsTypeRepository.class);
        NewsMessagingService newsMessagingService = Mockito.mock(NewsMessagingService.class);
        NewsService service = new NewsService(newsRepository, typeRepository, Mockito.mock(UserService.class),
                newsMessagingService, Mockito.mock(NotificationPushService.class));
        NewsType type = new NewsType();
        type.setId(1L);
        News existing = new News();
        existing.setId(5L);
        existing.setImageUrl("https://media.robertsspaceindustries.com/old.jpg");
        when(newsRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(typeRepository.findById(1L)).thenReturn(Optional.of(type));
        when(newsRepository.save(any(News.class))).thenAnswer(invocation -> invocation.getArgument(0));

        News keep = new News();
        keep.setType(type);
        service.update(5L, keep);
        assertThat(existing.getImageUrl()).isEqualTo("https://media.robertsspaceindustries.com/old.jpg");

        News change = new News();
        change.setType(type);
        change.setImageUrl("  https://media.robertsspaceindustries.com/cover.jpg ");
        service.update(5L, change);
        assertThat(existing.getImageUrl()).isEqualTo("https://media.robertsspaceindustries.com/cover.jpg");
        verify(newsMessagingService, Mockito.times(2)).sendNewsUpdated(existing);

        News clear = new News();
        clear.setType(type);
        clear.setImageUrl(" ");
        service.update(5L, clear);
        assertThat(existing.getImageUrl()).isNull();
    }

    @Test
    void rejectsImagesThatAreNotHttps() {
        for (String value : new String[]{"http://example.com/a.jpg", "javascript:alert(1)", "/images/a.jpg", "https://user@example.com/a.jpg"}) {
            assertThatThrownBy(() -> NewsService.normalizeImageUrl(value))
                    .isInstanceOf(com.icy.icy_backend.exception.definition.BadRequestException.class);
        }
    }
}
