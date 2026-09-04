package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

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
                null, "NOT_A_REAL_FAMILY", "ACTIVE", "ALL", null, "name", 0, 24
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Famille catalogue inconnue");

        verifyNoInteractions(jdbcTemplate);
    }
}
