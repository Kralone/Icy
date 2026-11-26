package com.icy.icy_backend.controller.dto.response.ship;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ShipCatalogStatsTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void readsTheWikiVehicleFields() throws Exception {
        ShipCatalogStats stats = ShipCatalogStats.from(mapper.readTree("""
                {"size_class":2,"career":"Combat","role":"Interceptor","crew":{"min":1,"max":1},"cargo_capacity":0,
                 "dimension":{"length":20,"width":15,"height":6.5},"mass":48986,"mass_total":55317,
                 "speed":{"scm":262,"max":1425,"boost_forward":610},"agility":{"pitch":53,"yaw":48,"roll":190},
                 "health":11900,"shield_hp":4488,"fuel":{"capacity":1.2},
                 "quantum":{"quantum_speed":189309100,"quantum_range":61224489796,"quantum_fuel_capacity":0.6},
                 "weaponry":{"pilot_dps":2359.6,"missiles":{"count":4}},
                 "insurance":{"claim_time":4.86,"expedite_time":1.62,"expedite_cost":2658},
                 "game_description":{"en_EN":"Initially designed by Aegis"}}
                """));
        assertThat(stats.sizeClass()).isEqualTo(2);
        assertThat(stats.role()).isEqualTo("Interceptor");
        assertThat(stats.crewMax()).isEqualTo(1);
        assertThat(stats.cargoScu()).isEqualTo(0.0);
        assertThat(stats.width()).isEqualTo(15.0);
        assertThat(stats.mass()).isEqualTo(55317.0);
        assertThat(stats.scmSpeed()).isEqualTo(262.0);
        assertThat(stats.roll()).isEqualTo(190.0);
        assertThat(stats.shield()).isEqualTo(4488.0);
        assertThat(stats.quantumRange()).isEqualTo(61224489796.0);
        assertThat(stats.missiles()).isEqualTo(4);
        assertThat(stats.insuranceExpediteCost()).isEqualTo(2658.0);
        assertThat(stats.description()).isEqualTo("Initially designed by Aegis");
    }

    @Test
    void leavesMissingOrInvalidValuesEmpty() throws Exception {
        ShipCatalogStats stats = ShipCatalogStats.from(mapper.readTree("""
                {"sizes":{"length":26.5,"beam":16.5},"mass":122096,"speed":{"scm":null,"max":0},"health":"n/a",
                 "crew_min":1,"crew_max":2,"game_description":{"fr_FR":"Mineur solo","en_EN":"Solo miner"}}
                """));
        assertThat(stats.width()).isEqualTo(16.5);
        assertThat(stats.mass()).isEqualTo(122096.0);
        assertThat(stats.scmSpeed()).isNull();
        assertThat(stats.maxSpeed()).isNull();
        assertThat(stats.hull()).isNull();
        assertThat(stats.cargoScu()).isNull();
        assertThat(stats.crewMax()).isEqualTo(2);
        assertThat(stats.description()).isEqualTo("Mineur solo");
        assertThat(ShipCatalogStats.from(null)).isNull();
    }
}
