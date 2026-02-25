package com.icy.icy_backend.service.collection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.icy.icy_backend.controller.dto.collection.TemplateCreateDTO;
import com.icy.icy_backend.db.entity.collection.CollectionTemplate;
import com.icy.icy_backend.db.entity.collection.UserCollection;
import com.icy.icy_backend.db.repository.collection.CollectionTemplateRepository;
import com.icy.icy_backend.db.repository.collection.UserCollectionRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class CollectionServiceTest {

    @Test
    void getTemplatesFiltersByQuery() {
        CollectionTemplateRepository templateRepository = Mockito.mock(CollectionTemplateRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        CollectionService service = new CollectionService(templateRepository, userCollectionRepository, notificationPushService);

        CollectionTemplate t1 = new CollectionTemplate(1L, "Alpha", "A", "[]", "[]", null, Instant.now());
        CollectionTemplate t2 = new CollectionTemplate(2L, "Bravo", "A", "[]", "[]", null, Instant.now());
        when(templateRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(t1, t2));

        assertThat(service.getTemplates(null, "al")).hasSize(1);
    }

    @Test
    void createTemplateValidatesNameAndDuplicates() {
        CollectionTemplateRepository templateRepository = Mockito.mock(CollectionTemplateRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        CollectionService service = new CollectionService(templateRepository, userCollectionRepository, notificationPushService);

        TemplateCreateDTO dto = new TemplateCreateDTO();
        dto.setName(" ");
        assertThatThrownBy(() -> service.createTemplate(dto))
                .isInstanceOf(BadRequestException.class);

        dto.setName("Test");
        when(templateRepository.existsByName("Test")).thenReturn(true);
        assertThatThrownBy(() -> service.createTemplate(dto))
                .isInstanceOf(ResourceAlreadyExistsException.class);
    }

    @Test
    void patchCellUpdatesCheckedState() {
        CollectionTemplateRepository templateRepository = Mockito.mock(CollectionTemplateRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        CollectionService service = new CollectionService(templateRepository, userCollectionRepository, notificationPushService);

        ObjectMapper mapper = new ObjectMapper();
        ArrayNode checked = mapper.createArrayNode();
        checked.add("a|1");

        UserCollection uc = UserCollection.builder()
                .id(10L)
                .userId("user")
                .checked(checked)
                .build();
        when(userCollectionRepository.findById(10L)).thenReturn(Optional.of(uc));

        List<String> updated = service.patchCell("user", 10L, "b", "2", true);
        assertThat(updated).contains("a|1", "b|2");

        List<String> removed = service.patchCell("user", 10L, "a", "1", false);
        assertThat(removed).doesNotContain("a|1");
        Mockito.verify(userCollectionRepository, Mockito.atLeastOnce()).save(any());
    }
}
