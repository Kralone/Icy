package com.icy.icy_backend.service.ship;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.ship.Ship;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.sql.ResultSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShipCatalogEnrichmentTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void batchesCatalogLookupAndRespectsManualImageOverride() throws Exception {
        var jdbc = mock(NamedParameterJdbcTemplate.class);
        var row = mock(ResultSet.class);
        when(row.getLong("id")).thenReturn(12L);
        when(row.getString("source_payload")).thenReturn("""
                {"uuid":"variant","image_source_vehicle_uuid":"base","executive_hangar":true}
                """);
        when(row.getString("catalog_group")).thenReturn("WIKELO");
        when(row.getString("image_override_url")).thenReturn("/images/manual.webp");
        doAnswer(invocation -> {
            assertThat((Map<String, ?>) invocation.getArgument(1)).containsKey("ids");
            ((RowCallbackHandler) invocation.getArgument(2)).processRow(row);
            return null;
        }).when(jdbc).query(anyString(), anyMap(), any(RowCallbackHandler.class));
        Ship first = new Ship();
        first.setId(12L);
        Ship second = new Ship();
        second.setId(13L);
        new ShipCatalogEnrichment(jdbc, mapper).enrich(List.of(first, second));
        verify(jdbc, times(1)).query(anyString(), anyMap(), any(RowCallbackHandler.class));
        assertThat(first.getCatalogGroup()).isEqualTo("WIKELO");
        assertThat(first.getExecutiveHangar()).isTrue();
        assertThat(first.getImageIsBase()).isFalse();
        assertThat(second.getExecutiveHangar()).isNull();
    }

    @Test
    void projectsActualPyamVariantPortsIncludingWeaponsNestedBelowGimbals() throws Exception {
        // Reduced live API response: /api/vehicles/49e65480-0ab3-bead-8207-2da32c2e00ab (2026-09-19).
        var payload = mapper.readTree(getClass().getResourceAsStream("/ships/f8c-pyam-ports.json"));
        Ship ship = new Ship();
        ShipCatalogEnrichment.applyPayload(ship, payload);
        assertThat(ship.getExecutiveHangar()).isTrue();
        assertThat(ship.getComponents()).extracting(Ship.LoadoutItem::name)
                .contains("SnowBlind", "Eclipse", "Colossus", "Umbra");
        assertThat(ship.getWeapons()).extracting(Ship.LoadoutItem::name)
                .contains("NDB-28 Repeater", "NDB-30 Repeater", "Ignite II Missile");
        assertThat(ship.getWeapons().stream().filter(item -> item.name().equals("NDB-28 Repeater")))
                .singleElement().satisfies(item -> assertThat(item.quantity()).isGreaterThan(1));
        assertThat(ship.getComponents()).noneMatch(item -> item.name().contains("PLACEHOLDER"));
    }

    @Test
    void absentVariantPortsStayUnknownAndNeverReadStandardVehicleLoadout() throws Exception {
        Ship ship = new Ship();
        ShipCatalogEnrichment.applyPayload(ship, mapper.readTree("""
                {"uuid":"variant", "image_source_vehicle_uuid":"base", "executive_hangar":false,
                 "base_variant":{"ports":[{"equipped_item":{"name":"Wrong standard shield","type":"Shield"}}]}}
                """));
        assertThat(ship.getExecutiveHangar()).isFalse();
        assertThat(ship.getImageIsBase()).isTrue();
        assertThat(ship.getComponents()).isEmpty();
        assertThat(ship.getWeapons()).isEmpty();
        ShipCatalogEnrichment.applyPayload(ship, mapper.readTree("{}"));
        assertThat(ship.getExecutiveHangar()).isNull();
        assertThat(ship.getImageIsBase()).isFalse();
    }
}
