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
            objectMapper,
            Mockito.mock(CatalogConflictService.class)
    );

    @Test
    void recognizesLocalizedWikiFlightReadyStatus() throws Exception {
        assertThat(mapper.vehicleFlightReady("vehicles", json("""
                {"production_status":{"en_EN":"flight-ready","fr_FR":"Prêt à voler"}}
                """))).isTrue();
    }

    @Test
    void unnamedWikiPlaceholderDoesNotBlockValidMineralPublication() throws Exception {
        var jdbc = Mockito.mock(NamedParameterJdbcTemplate.class);
        var store = Mockito.mock(CatalogRawStore.class);
        var subject = new CatalogMapper(jdbc, store, objectMapper, Mockito.mock(CatalogConflictService.class));
        when(store.loadActive(CatalogMapper.WIKI_SOURCE, "commodities")).thenReturn(List.of(
            json("""
                {"uuid":"gold","name":"Gold","is_mineable":true,"systems_grouped":[{"name":"Stanton","locations":[{"name":"Daymar","resources":[{"materials":[{"uuid":"gold","min_percentage":2,"max_percentage":10}]}]}]}]}
                """),
            json("""
                {"uuid":"272539c8-e211-4c82-8bd0-6ecaabbc9c10","name":"","is_mineable":true,"description":"<= PLACEHOLDER =>"}
                """)));
        assertThat(subject.mapWikiDataset("commodities", 42L)).isEqualTo(1);
    }

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
        CatalogMapper batchMapper = new CatalogMapper(
                jdbcTemplate, rawStore, objectMapper, Mockito.mock(CatalogConflictService.class)
        );
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

    @Test
    void readsLocalizedDescriptionsInFrenchThenEnglish() throws Exception {
        assertThat(mapper.localizedText(
                json("{\"description\":{\"fr_FR\":\"Description française\",\"en_EN\":\"English description\"}}"),
                "description"
        )).isEqualTo("Description française");
        assertThat(mapper.localizedText(
                json("{\"description\":{\"en_EN\":\"English description\"}}"),
                "description"
        )).isEqualTo("English description");
        assertThat(mapper.localizedText(
                json("{\"description\":\"Simple description\"}"),
                "description"
        )).isEqualTo("Simple description");
    }

    @Test
    void extractsCanonicalShipFieldsFromWikiVehicle() throws Exception {
        JsonNode basher = json("""
                {
                  "role": "Light Fighter",
                  "cargo_capacity": 0,
                  "size_label": "Small",
                  "crew_min": 1,
                  "crew_max": 1,
                  "production_status": "Flight ready"
                }
                """);

        assertThat(mapper.vehicleFocus("vehicles", basher)).isEqualTo("Light Fighter");
        assertThat(mapper.vehicleScu("vehicles", basher)).isZero();
        assertThat(mapper.vehicleSize("vehicles", basher)).isEqualTo("Small");
        assertThat(mapper.vehicleCrew("vehicles", basher)).isEqualTo("1");
        assertThat(mapper.vehicleFlightReady("vehicles", basher)).isTrue();
    }


    @Test
    void readsActualStationAndCityMarkersInsteadOfGenericSourceClassification() throws Exception {
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"Manmade","classification":"Manmade"},
                 "radar_contact_type":{"name":"SpaceStation"}}
                """))).isEqualTo("STATION");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"Manmade_VisibleOnInteraction","classification":"Manmade"},
                 "radar_contact_type":{"name":null,"tag_name":"SpaceStation"}}
                """))).isEqualTo("STATION");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"LandingZone","classification":"Settlement"}}
                """))).isEqualTo("CITY");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"Manmade","classification":"Manmade"},
                 "radar_contact_type":{"name":"LandingZone"}}
                """))).isEqualTo("CITY");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"JumpPoint","classification":"Manmade"}}
                """))).isEqualTo("JUMP_POINT");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"SolarSystem","classification":"Solar System"}}
                """))).isEqualTo("SYSTEM");
    }

    @Test
    void usesExactUexPlaceNamesWhenTheWikiHasNoMarker() throws Exception {
        var uexPlaces = java.util.Map.of("port tressler", "STATION", "new babbage", "CITY");
        assertThat(mapper.family("locations", json("""
                {"name":"  Port   Tressler ","type":{"name":"Manmade","classification":"Manmade"},
                 "radar_contact_type":{"name":"CommArray"}}
                """), uexPlaces)).isEqualTo("STATION");
        assertThat(mapper.family("locations", json("""
                {"name":"New Babbage","type":{"name":"Manmade"}}
                """), uexPlaces)).isEqualTo("CITY");
        assertThat(mapper.family("locations", json("""
                {"name":"Port Tressler Hangar","type":{"name":"Manmade"}}
                """), uexPlaces)).isEqualTo("LOCATION");
        assertThat(mapper.family("locations", json("""
                {"name":"Port Tressler","type":{"name":"JumpPoint"}}
                """), uexPlaces)).isEqualTo("JUMP_POINT");
    }

    @Test
    void keepsGenericPlacesAndChildrenDistinctWithoutInferringFromNamesOrParents() throws Exception {
        assertThat(mapper.family("locations", json("""
                {"name":"Everus Harbor Clinic","type":{"name":"Outpost","classification":"Outpost"},
                 "parent":{"name":"Everus Harbor","type_name":"Manmade"},"radar_contact_type":{"name":null}}
                """))).isEqualTo("OUTPOST");
        assertThat(mapper.family("locations", json("""
                {"name":"Space Station City","type":{"name":"Manmade","classification":"Manmade"},
                 "radar_contact_type":{"name":"CommArray"}}
                """))).isEqualTo("LOCATION");
        assertThat(mapper.family("locations", json("{}"))).isEqualTo("LOCATION");
        assertThat(mapper.family("locations", json("""
                {"type":{"name":"Unknown","classification":"Outpost"}}
                """))).isEqualTo("OUTPOST");
    }


    @Test
    void cargoCapacityComesFromTheExactVehicleAndDistinguishesUnknownFromZero() throws Exception {
        assertThat(mapper.vehicleScu("vehicles", json("""
                {"name":"C2 Hercules Starlifter","cargo_capacity":696}
                """))).isEqualTo(696);
        assertThat(mapper.vehicleScu("vehicles", json("""
                {"name":"A2 Hercules Starlifter Wikelo War Special","cargo_capacity":216}
                """))).isEqualTo(216);
        assertThat(mapper.vehicleScu("vehicles", json("""
                {"name":"Golem","cargo_capacity":0,"ore_capacity":32}
                """))).isZero();
        for (String value : List.of("null", "-1", "0.5", "2147483648", "\"64\"")) {
            assertThat(mapper.vehicleScu("vehicles", json("{\"cargo_capacity\":" + value + "}"))).isNull();
        }
        assertThat(mapper.vehicleScu("vehicles", json("{}"))).isNull();
        assertThat(mapper.vehicleScu("items", json("{\"cargo_capacity\":64}"))).isNull();
    }

    private JsonNode location(String classification) throws Exception {
        return json("{\"type\":{\"classification\":\"" + classification + "\"}}");
    }

    private JsonNode json(String value) throws Exception {
        return objectMapper.readTree(value);
    }
}
