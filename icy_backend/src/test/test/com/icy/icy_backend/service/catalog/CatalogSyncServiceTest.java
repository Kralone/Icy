package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import com.icy.icy_backend.db.repository.catalog.CatalogSyncRunRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CatalogSyncServiceTest {

    @Test
    void globalActionQueuesScrapeAndMapForEveryCatalogFamily() {
        CatalogSyncRunRepository runRepository = mock(CatalogSyncRunRepository.class);
        CatalogSyncWorker worker = mock(CatalogSyncWorker.class);
        MessageService messageService = mock(MessageService.class);
        when(runRepository.existsByStatusIn(any())).thenReturn(false);
        when(runRepository.saveAndFlush(any(CatalogSyncRun.class))).thenAnswer(invocation -> {
            CatalogSyncRun run = invocation.getArgument(0);
            run.setId(42L);
            return run;
        });

        CatalogSyncService service = new CatalogSyncService(runRepository, worker, messageService);
        service.startScrapeAll();

        ArgumentCaptor<CatalogSyncRun> runCaptor = ArgumentCaptor.forClass(CatalogSyncRun.class);
        verify(runRepository).saveAndFlush(runCaptor.capture());
        assertThat(runCaptor.getValue().getOperation()).isEqualTo("SCRAPE_AND_MAP_ALL");
        assertThat(runCaptor.getValue().getScope()).isNull();
        verify(worker).run(42L, "SCRAPE_AND_MAP_ALL", null);
    }
}
