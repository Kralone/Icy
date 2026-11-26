package com.icy.icy_backend.service.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CatalogMiningServiceTest {
    @Test
    void buildsTheQueryWithoutTreatingLikePatternsAsFormats() {
        String sql = CatalogMiningService.sql();
        assertThat(sql).contains("LIKE '%baliaga%'").doesNotContain("{FLIGHT_READY}");
        assertThat(sql).contains("AS \"flightReady\"").contains("'flight-ready'");
    }

    @Test
    void listsMiningEquipment() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("kind", "ship")));
        assertThat(new CatalogMiningService(jdbc).list()).hasSize(1);
    }
}
