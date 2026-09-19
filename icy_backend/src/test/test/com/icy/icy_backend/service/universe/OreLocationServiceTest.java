package com.icy.icy_backend.service.universe;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.universe.OreLocation;
import com.icy.icy_backend.db.repository.universe.OreLocationRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.catalog.CatalogOreDistributionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OreLocationServiceTest {
    private final OreLocationRepository repository = mock(OreLocationRepository.class);
    private final OreLocationService service = new OreLocationService(repository, mock(MessageService.class), new ObjectMapper(), mock(CatalogOreDistributionService.class));

    private void upload(String json) {
        service.uploadAndReplace(new MockMultipartFile("file", "mining.json", "application/json", json.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void rejectsEmptyOrMalformedImportsWithoutDeletingExistingRows() {
        for (String json : List.of("{}", "null", "{\"locations\":[]}", "{\"metadata\":{}}", "{\"HUR\":{\"ores\":{}}}",
                "{\"HUR\":{\"ores\":{\"GOLD\":{\"prob\":\"unknown\"}}}}",
                "{\"HUR\":{\"ores\":{\"GOLD\":{\"prob\":2}}}}",
                "{\"HUR\":{\"ores\":{\"GOLD\":{\"minPct\":0.8,\"maxPct\":0.1}}}}")) {
            assertThatThrownBy(() -> upload(json)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsInvalidMetricObjectsAndRangesWithoutDeletingExistingRows() {
        for (String metric : List.of("clusterCount", "mass", "inst", "res")) {
            for (String range : List.of("\"invalid\"", "[]", "{\"min\":5,\"max\":2}", "{\"min\":2,\"med\":1}", "{\"med\":3,\"max\":2}")) {
                String json = "{\"HUR\":{\"ores\":{\"GOLD\":{}},\"" + metric + "\":" + range + "}}";
                assertThatThrownBy(() -> upload(json)).isInstanceOf(BadRequestException.class);
            }
        }
        verifyNoInteractions(repository);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void preservesUnknownMetricsAndImportsProvenanceWithoutTreatingMetadataAsLocations() {
        upload("""
                {"source_url":"https://example.org/mining", "game_version":"4.10",
                 "locations":{"HUR":{"ores":{"GOLD":{"prob":0,"minPct":0.1,"maxPct":0.8}}}}}
                """);
        ArgumentCaptor<List<OreLocation>> captor = ArgumentCaptor.forClass((Class) List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        OreLocation row = captor.getValue().getFirst();
        assertThat(row.getGameVersion()).isEqualTo("4.10");
        assertThat(row.getSourceUrl()).isEqualTo("https://example.org/mining");
        assertThat(row.getUsersCount()).isNull();
        assertThat(row.getOres().getFirst().getProbability()).isZero();
        assertThat(row.getOres().getFirst().getMedPct()).isNull();
    }
}
