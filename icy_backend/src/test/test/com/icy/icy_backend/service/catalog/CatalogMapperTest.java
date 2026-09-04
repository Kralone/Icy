package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogMapperTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CatalogMapper mapper = new CatalogMapper(
            Mockito.mock(NamedParameterJdbcTemplate.class),
            Mockito.mock(CatalogRawStore.class),
            objectMapper
    );

    @Test
    void classifiesThePublicCatalogFamilies() throws Exception {
        assertThat(mapper.family("vehicles", json("{\"is_spaceship\":true}"))).isEqualTo("SHIP");
        assertThat(mapper.family("vehicles", json("{\"is_vehicle\":true}"))).isEqualTo("GROUND_VEHICLE");
        assertThat(mapper.family("vehicles", json("{\"is_power_suit\":true}"))).isEqualTo("POWER_SUIT");

        assertThat(mapper.family("items", json("{\"classification\":\"FPS.Armor.Helmet\"}"))).isEqualTo("ARMOR");
        assertThat(mapper.family("items", json("{\"classification\":\"FPS.Weapon.Medium\"}"))).isEqualTo("FPS_WEAPON");
        assertThat(mapper.family("items", json("{\"classification\":\"Ship.Weapon.Gun\"}"))).isEqualTo("SHIP_WEAPON");
        assertThat(mapper.family("items", json("{\"classification\":\"Ship.QuantumDrive\"}"))).isEqualTo("SHIP_COMPONENT");
        assertThat(mapper.family("items", json("{\"classification\":\"Mining.Module\"}"))).isEqualTo("MODULE");
        assertThat(mapper.family("items", json("{\"type\":\"ToolArm\"}"))).isEqualTo("TOOL");

        assertThat(mapper.family("locations", location("Planet"))).isEqualTo("PLANET");
        assertThat(mapper.family("locations", location("Moon"))).isEqualTo("MOON");
        assertThat(mapper.family("locations", location("Landing Zone"))).isEqualTo("CITY");
        assertThat(mapper.family("locations", location("Space Station"))).isEqualTo("STATION");
        assertThat(mapper.family("locations", location("Jump Point"))).isEqualTo("JUMP_POINT");
    }

    private JsonNode location(String classification) throws Exception {
        return json("{\"type\":{\"classification\":\"" + classification + "\"}}");
    }

    private JsonNode json(String value) throws Exception {
        return objectMapper.readTree(value);
    }
}
