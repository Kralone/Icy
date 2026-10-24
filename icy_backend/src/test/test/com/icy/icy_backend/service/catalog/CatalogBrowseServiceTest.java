package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class CatalogBrowseServiceTest {
    private final NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
    private final CatalogBrowseService service = new CatalogBrowseService(
            jdbcTemplate,
            mock(MessageService.class)
    );

    @Test
    void rejectsUnknownFamiliesBeforeQueryingTheDatabase() {
        assertThatThrownBy(() -> service.browse(
                null, "NOT_A_REAL_FAMILY", "ALL", "ACTIVE", "ALL", null, "name", 0, 24
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Famille catalogue inconnue");

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void separatesOrderByFromTheSelectedSortExpression() {
        String sql = CatalogBrowseService.buildPageQuery(
                "WITH ranked_entries AS (SELECT 1)\n",
                "LOWER(e.name) ASC, e.id ASC"
        );

        assertThat(sql)
                .contains("ORDER BY LOWER(e.name) ASC, e.id ASC")
                .doesNotContain("ORDER BYLOWER");
    }

    @Test
    void resolvesOfferPlacesFromTheUexTerminalOfEachOffer() {
        assertThat(CatalogBrowseService.OFFERS_SQL)
                .contains("cache.dataset_key = 'terminals'")
                .contains("LEFT JOIN terminals t ON o.source = 'UEX'")
                .contains("t.terminal->>'id' = o.source_payload->>'id_terminal'")
                .contains("AS planet_name")
                .contains("AS place_name")
                .contains("p.poi->>'id' = NULLIF(t.terminal->>'id_poi', '0')")
                .contains("o.active = TRUE AND o.entry_id IN (:entryIds)");
    }
}
