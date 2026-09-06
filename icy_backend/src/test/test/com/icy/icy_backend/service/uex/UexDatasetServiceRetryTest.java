package com.icy.icy_backend.service.uex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.UexProperties;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class UexDatasetServiceRetryTest {

    @Test
    void declaresTheProductionConstructorForSpringInjection() throws NoSuchMethodException {
        var constructor = UexDatasetService.class.getConstructor(
                UexDatasetCacheRepository.class,
                MessageService.class,
                UexProperties.class,
                ObjectMapper.class
        );

        assertThat(constructor.isAnnotationPresent(Autowired.class)).isTrue();
    }

    @Test
    void retriesATemporaryFailureBeforeReplacingTheCachedDataset() {
        Fixture fixture = fixture(3);
        fixture.server.expect(once(), requestTo("https://uex.test/categories"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        fixture.server.expect(once(), requestTo("https://uex.test/categories"))
                .andRespond(withSuccess("{\"status\":\"ok\",\"data\":[{\"id\":1}]}", MediaType.APPLICATION_JSON));

        var response = fixture.service.refreshDataset("categories");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData().getItemCount()).isEqualTo(1);
        verify(fixture.repository).save(any(UexDatasetCache.class));
        fixture.server.verify();
    }

    @Test
    void keepsTheCachedDatasetWhenEveryAttemptFails() {
        Fixture fixture = fixture(3);
        for (int attempt = 0; attempt < 3; attempt++) {
            fixture.server.expect(once(), requestTo("https://uex.test/categories"))
                    .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        }

        var response = fixture.service.refreshDataset("categories");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(fixture.repository, never()).save(any(UexDatasetCache.class));
        fixture.server.verify();
    }

    private Fixture fixture(int attempts) {
        UexDatasetCacheRepository repository = mock(UexDatasetCacheRepository.class);
        when(repository.findById("categories")).thenReturn(Optional.empty());
        when(repository.save(any(UexDatasetCache.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UexProperties properties = new UexProperties();
        properties.setBaseUrl("https://uex.test");
        properties.setRefreshAttempts(attempts);
        properties.setRetryDelayMillis(0);

        ResourceBundleMessageSource messages = new ResourceBundleMessageSource();
        messages.setBasename("messages");
        messages.setDefaultEncoding("UTF-8");

        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        UexDatasetService service = new UexDatasetService(
                repository,
                new MessageService(messages),
                properties,
                new ObjectMapper(),
                restTemplate
        );
        return new Fixture(service, repository, server);
    }

    private record Fixture(
            UexDatasetService service,
            UexDatasetCacheRepository repository,
            MockRestServiceServer server
    ) {}
}
