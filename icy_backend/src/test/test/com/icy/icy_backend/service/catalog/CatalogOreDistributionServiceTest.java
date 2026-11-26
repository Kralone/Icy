package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.TreeMap;
import static org.assertj.core.api.Assertions.*;

class CatalogOreDistributionServiceTest {
    @Test
    void usesMatchingConcentrationsAndGameSpawnChanceWithoutInventingMedian() throws Exception {
        var rows = new TreeMap<String, CatalogOreDistributionService.Location>();
        var node = new ObjectMapper().readTree("""
          {"uuid":"agricium","name":"Agricium (Ore)","systems_grouped":[{"locations":[{
            "name":"HUR L1","relative_probability":0.3,"group_probability":0.05,
            "resources":[{"materials":[
              {"uuid":"other","min_percentage":80,"max_percentage":100},
              {"uuid":"agricium","min_percentage":2,"max_percentage":5},
              {"uuid":"agricium","min_percentage":1,"max_percentage":7}
            ]}]}]}]}
          """);
        CatalogOreDistributionService.add(rows, node, 42L, "/ore.png", null, null);
        var dto = rows.get("wiki:|HUR-L1").dto();
        assertThat(dto.locationKey()).isEqualTo("wiki:|HUR-L1");
        assertThat(dto.gameVersion()).isNull();
        assertThat(dto.systemName()).isNull();
        var ore = dto.ores().getFirst();
        assertThat(ore.minPct()).isEqualTo(0.01);
        assertThat(ore.maxPct()).isEqualTo(0.07);
        assertThat(ore.probability()).isEqualTo(0.3);
        assertThat(ore.method()).isNull();
        assertThat(ore.catalogEntryId()).isEqualTo(42L);
    }
    @Test
    void readsMiningMethodClustersAndFallsBackToRockProbability() throws Exception {
        var node = new ObjectMapper().readTree("""
          {"uuid":"quant","name":"Quantainium (Raw)","systems_grouped":[{"name":"Stanton","locations":[
            {"name":"Aberdeen","uuid":"aberdeen","resources":[
              {"group_name":"SpaceShip_Mineables","relative_probability_max":0.02,
               "clustering":{"min_size":2,"max_size":3,"probability":0.25},
               "materials":[{"uuid":"quant","min_percentage":28.3,"max_percentage":78.3}]},
              {"group_name":"FPS_Mineables","relative_probability_max":0.5,
               "materials":[{"uuid":"other","min_percentage":10,"max_percentage":20}]}
            ]}]}]}
          """);
        var rows = new TreeMap<String, CatalogOreDistributionService.Location>();
        CatalogOreDistributionService.add(rows, node, 7L, null, "4.10.3-LIVE", null);
        var dto = rows.get("wiki:aberdeen").dto();
        var ore = dto.ores().getFirst();
        assertThat(dto.gameVersion()).isEqualTo("4.10.3-LIVE");
        assertThat(dto.systemName()).isEqualTo("Stanton");
        assertThat(ore.probability()).isEqualTo(0.02);
        assertThat(ore.method()).isEqualTo("Vaisseau");
        assertThat(ore.clusterMin()).isEqualTo(2);
        assertThat(ore.clusterMax()).isEqualTo(3);
        assertThat(ore.clusterProbability()).isEqualTo(0.25);
        assertThat(ore.minPct()).isCloseTo(0.283, within(1e-9));
    }
    @Test
    void ignoresOutOfRangeProbabilities() throws Exception {
        var node = new ObjectMapper().readTree("""
          {"uuid":"ore","name":"Ore","systems_grouped":[{"locations":[{"name":"Daymar","relative_probability":4,
          "resources":[{"materials":[{"uuid":"ore","min_percentage":1}]}]}]}]}
          """);
        var rows = new TreeMap<String, CatalogOreDistributionService.Location>();
        CatalogOreDistributionService.add(rows, node, 1L, null, null, null);
        assertThat(rows.get("wiki:|DAYMAR").dto().ores().getFirst().probability()).isNull();
    }
    @Test
    void keepsSameNamedLocationsInDifferentSystemsSeparateAndKeysStable() throws Exception {
        var node = new ObjectMapper().readTree("""
          {"uuid":"ore","name":"Ore","systems_grouped":[
            {"name":"Stanton","locations":[{"name":"Belt","uuid":"place-a",
              "resources":[{"materials":[{"uuid":"ore","min_percentage":2}]}]}]},
            {"name":"Pyro","locations":[{"name":"Belt","uuid":"place-b",
              "resources":[{"materials":[{"uuid":"ore","min_percentage":3}]}]}]}
          ]}
          """);
        var rows = new TreeMap<String, CatalogOreDistributionService.Location>();
        CatalogOreDistributionService.add(rows, node, 1L, null, null, null);
        CatalogOreDistributionService.add(rows, node, 1L, null, null, null);
        assertThat(rows).hasSize(2);
        assertThat(rows.get("wiki:place-a").dto().locationKey()).isEqualTo("wiki:place-a");
        assertThat(rows.get("wiki:place-b").dto().ores().getFirst().minPct()).isEqualTo(0.03);
    }
    @Test
    void rejectsInvalidConcentrations() throws Exception {
        var node = new ObjectMapper().readTree("""
          {"uuid":"ore","name":"Ore","systems_grouped":[{"locations":[{"name":"Daymar",
          "resources":[{"materials":[{"uuid":"ore","min_percentage":101}]}]}]}]}
          """);
        assertThatThrownBy(() -> CatalogOreDistributionService.add(new TreeMap<>(), node, 1L, null, null, null))
            .isInstanceOf(IllegalStateException.class);
    }
}
