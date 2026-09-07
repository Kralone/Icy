package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void writesLargeCatalogsInBoundedBatches() throws Exception {
        NamedParameterJdbcTemplate jdbcTemplate = Mockito.mock(NamedParameterJdbcTemplate.class);
        CatalogRawStore rawStore = Mockito.mock(CatalogRawStore.class);
        CatalogMapper batchMapper = new CatalogMapper(jdbcTemplate, rawStore, objectMapper);
        List<JsonNode> records = new ArrayList<>();
        for (int index = 0; index <= CatalogMapper.BATCH_SIZE; index++) {
            records.add(json("{\"uuid\":\"item-" + index + "\",\"name\":\"Item " + index + "\"}"));
        }
        when(rawStore.loadActive(CatalogMapper.WIKI_SOURCE, "items")).thenReturn(records);

        int mapped = batchMapper.mapWikiDataset("items", 42L);

        assertThat(mapped).isEqualTo(CatalogMapper.BATCH_SIZE + 1);
        verify(jdbcTemplate, times(2)).batchUpdate(anyString(), any(org.springframework.jdbc.core.namedparam.SqlParameterSource[].class));
        verify(jdbcTemplate).update(anyString(), any(org.springframework.jdbc.core.namedparam.SqlParameterSource.class));
    }

    private JsonNode location(String classification) throws Exception {
        return json("{\"type\":{\"classification\":\"" + classification + "\"}}");
    }

    private JsonNode json(String value) throws Exception {
        return objectMapper.readTree(value);
    }
}
