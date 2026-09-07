package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CatalogConflictServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void pausesForAPreviouslyUnknownEditionConflict() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
        when(jdbcTemplate.queryForObject(
                contains("INSERT INTO catalog.sync_conflicts"), any(SqlParameterSource.class), eq(Long.class)
        )).thenReturn(7L);
        CatalogConflictService service = new CatalogConflictService(jdbcTemplate, objectMapper);
        List<JsonNode> records = List.of(
                vehicle("base", "Carrack", "anvl-carrack"),
                vehicle("edition", "Carrack Expedition", "anvl-carrack-expedition")
        );

        assertThatThrownBy(() -> service.prepareVehicleMapping(records, 42L))
                .isInstanceOf(CatalogReviewRequiredException.class)
                .hasMessageContaining("1 conflit");

        verify(jdbcTemplate).batchUpdate(
                contains("INSERT INTO catalog.sync_conflict_candidates"),
                any(SqlParameterSource[].class)
        );
    }

    private JsonNode vehicle(String uuid, String name, String slug) throws Exception {
        return objectMapper.readTree("""
                {
                  "uuid": "%s",
                  "name": "%s",
                  "slug": "%s",
                  "is_spaceship": true,
                  "manufacturer": {"name": "Anvil Aerospace"},
                  "images": []
                }
                """.formatted(uuid, name, slug));
    }
}
