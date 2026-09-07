package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class CatalogRawStoreTest {

    @Test
    void storesLargeSourceDatasetsInBoundedBatches() {
        NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        ObjectMapper objectMapper = new ObjectMapper();
        CatalogRawStore rawStore = new CatalogRawStore(jdbcTemplate, objectMapper);
        List<JsonNode> records = new ArrayList<>();
        for (int index = 0; index <= 250; index++) {
            records.add(objectMapper.createObjectNode()
                    .put("uuid", "item-" + index)
                    .put("name", "Item " + index));
        }

        int stored = rawStore.upsert("STAR_CITIZEN_WIKI", "items", records, 42L);

        assertThat(stored).isEqualTo(251);
        verify(jdbcTemplate, times(2)).batchUpdate(anyString(), any(org.springframework.jdbc.core.namedparam.SqlParameterSource[].class));
    }
}
