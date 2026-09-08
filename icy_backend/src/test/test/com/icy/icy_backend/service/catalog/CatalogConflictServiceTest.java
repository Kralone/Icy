package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.request.admin.CatalogConflictResolutionRequest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CatalogConflictServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void acceptsBothMultipleAndLegacySingleResolutionPayloads() {
        assertThat(new CatalogConflictResolutionRequest(List.of("base", "edition"), null).selection())
                .containsExactly("base", "edition");
        assertThat(new CatalogConflictResolutionRequest(null, "base").selection())
                .containsExactly("base");
    }

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

    @Test
    void doesNotTreatSpecialCollectionsAsVariantsOfTheStandardShip() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
        CatalogConflictService service = new CatalogConflictService(jdbcTemplate, objectMapper);

        Set<String> suppressed = service.prepareVehicleMapping(List.of(
                vehicle("standard", "F8C Lightning", "anvl-lightning-f8c"),
                vehicle("pyam", "F8C Lightning PYAM Exec", "anvl-lightning-f8c-pyam"),
                vehicle("wikelo", "F8C Lightning Wikelo War Special", "anvl-lightning-f8c-wikelo")
        ), 42L);

        assertThat(suppressed).isEmpty();
    }

    @Test
    void keepsAnyPreviouslySelectedSubsetOfAConflict() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
        String canonicalKey = CatalogCanonicalizer.vehicleKey("SHIP", "Anvil Aerospace", "Carrack");
        String fingerprint = fingerprint("base", "bis", "edition");
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(2);
            for (String selectedId : List.of("base", "edition")) {
                ResultSet resultSet = Mockito.mock(ResultSet.class);
                when(resultSet.getString("canonical_key")).thenReturn(canonicalKey);
                when(resultSet.getString("selected_external_id")).thenReturn(selectedId);
                when(resultSet.getString("candidate_fingerprint")).thenReturn(fingerprint);
                handler.processRow(resultSet);
            }
            return null;
        }).when(jdbcTemplate).query(
                contains("SELECT canonical_key"), any(SqlParameterSource.class), any(RowCallbackHandler.class)
        );
        CatalogConflictService service = new CatalogConflictService(jdbcTemplate, objectMapper);

        Set<String> suppressed = service.prepareVehicleMapping(List.of(
                vehicle("base", "Carrack", "anvl-carrack"),
                vehicle("edition", "Carrack Expedition", "anvl-carrack-expedition"),
                vehicle("bis", "Carrack 2950 Best in Show Edition", "anvl-carrack-2950-best-in-show")
        ), 42L);

        assertThat(suppressed).containsExactly("bis");
    }

    @Test
    @SuppressWarnings("unchecked")
    void persistsEverySelectedVariantWhenResolvingAConflict() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
        ResultSet conflictRow = Mockito.mock(ResultSet.class);
        when(conflictRow.getLong("run_id")).thenReturn(42L);
        when(conflictRow.getString("source")).thenReturn(CatalogMapper.WIKI_SOURCE);
        when(conflictRow.getString("dataset_key")).thenReturn("vehicles");
        when(conflictRow.getString("canonical_key")).thenReturn("ship|anvil|carrack");
        when(conflictRow.getString("candidate_fingerprint")).thenReturn("fingerprint");
        when(conflictRow.getString("status")).thenReturn("PENDING");
        when(jdbcTemplate.queryForObject(
                contains("FROM catalog.sync_conflicts"),
                any(SqlParameterSource.class),
                any(RowMapper.class)
        )).thenAnswer(invocation -> ((RowMapper<Object>) invocation.getArgument(2)).mapRow(conflictRow, 0));
        when(jdbcTemplate.query(
                contains("SELECT external_id"),
                any(SqlParameterSource.class),
                any(RowMapper.class)
        )).thenReturn(List.of("base", "edition", "bis"));
        when(jdbcTemplate.queryForObject(
                contains("SELECT COUNT(*)"), any(SqlParameterSource.class), eq(Integer.class)
        )).thenReturn(0);
        CatalogConflictService service = new CatalogConflictService(jdbcTemplate, objectMapper);

        CatalogConflictService.Resolution resolution = service.resolve(7L, List.of("base", "edition", "edition"));

        ArgumentCaptor<SqlParameterSource[]> canonicalSelections = ArgumentCaptor.forClass(SqlParameterSource[].class);
        verify(jdbcTemplate).batchUpdate(
                contains("INSERT INTO catalog.canonical_selections"), canonicalSelections.capture()
        );
        assertThat(canonicalSelections.getValue()).hasSize(2);
        assertThat(canonicalSelections.getValue())
                .extracting(parameters -> parameters.getValue("externalId"))
                .containsExactly("base", "edition");
        verify(jdbcTemplate).batchUpdate(
                contains("INSERT INTO catalog.sync_conflict_selections"), any(SqlParameterSource[].class)
        );
        assertThat(resolution.runId()).isEqualTo(42L);
        assertThat(resolution.remainingConflicts()).isZero();
    }

    private String fingerprint(String... ids) throws Exception {
        String value = String.join("\n", java.util.Arrays.stream(ids).sorted().toList());
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
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
