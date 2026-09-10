package com.icy.icy_backend.service.catalog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogVehicleMarketServiceTest {

    @Test
    void exposesOnlyActiveCatalogVehiclesWithValidOffers() {
        assertThat(CatalogVehicleMarketService.VEHICLE_OFFERS_SQL)
                .contains("JOIN catalog.entries e ON e.id = o.entry_id")
                .contains("o.source = 'UEX'")
                .contains("o.active = TRUE")
                .contains("e.active = TRUE")
                .contains("e.family IN ('SHIP', 'GROUND_VEHICLE')")
                .contains("o.offer_type = :offerType")
                .contains("o.price > 0")
                .contains("BTRIM(o.location_name) <> ''");
    }
}
