package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class WikiVehicleEnrichmentTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void sharesOnlyBaseIllustrationAndKeepsActualVariantEquipmentAndExecutiveMembership() throws Exception {
        var rest = new RestTemplate();
        var server = MockRestServiceServer.bindTo(rest).build();
        server.expect(requestTo(WikiVehicleEnrichment.GUIDE)).andRespond(withSuccess("""
                <div class="mw-parser-output"><ul><li><a href="/Other">Unrelated introductory list</a></li></ul><ul>
                <li><a href="/F8C_Lightning">Anvil F8C Lightning Executive</a></li>
                <li><a href="/Scorpius">RSI Scorpius Wikelo War Special</a></li>
                </ul></div>
                """, MediaType.TEXT_HTML));
        List<JsonNode> rows = List.of(
                mapper.readTree("""
                {"uuid":"base","name":"F8C Lightning","images":[{"original_url":"https://images.test/base.jpg"}],"ports":[{"name":"base-fit"}]}
                """), mapper.readTree("""
                {"uuid":"exec","name":"F8C Lightning PYAM Exec","images":[],"ports":[{"name":"special-fit"}]}
                """), mapper.readTree("""
                {"uuid":"wikelo","name":"F8C Lightning Wikelo War Special","images":[{"original_url":"https://images.test/variant.jpg"}]}
                """), mapper.readTree("""
                {"uuid":"scorpius","name":"Scorpius Wikelo Sneak Special","images":[{"original_url":"https://images.test/scorpius.jpg"}]}
                """));
        new WikiVehicleEnrichment(rest,"Test").enrich(rows);
        assertThat(rows.get(1).path("image_source_vehicle_uuid").asText()).isEqualTo("base");
        assertThat(rows.get(1).path("image_is_base").asBoolean()).isTrue();
        assertThat(rows.get(1).path("ports").get(0).path("name").asText()).isEqualTo("special-fit");
        assertThat(rows.get(1).path("executive_hangar").asBoolean()).isTrue();
        assertThat(rows.get(2).path("executive_hangar").asBoolean()).isFalse();
        assertThat(rows.get(2).path("images").get(0).path("original_url").asText()).endsWith("variant.jpg");
        assertThat(rows.get(3).path("executive_hangar").asBoolean()).isTrue();
        server.verify();
    }

    @Test
    void importsMissingBaseImageFromTheWikiPage() throws Exception {
        var rest = new RestTemplate();
        var server = MockRestServiceServer.bindTo(rest).build();
        server.expect(requestTo("https://starcitizen.tools/Fortune")).andRespond(withSuccess(
                "<meta property='og:image' content='https://media.starcitizen.tools/fortune.jpg'>", MediaType.TEXT_HTML));
        JsonNode row = mapper.readTree("{\"uuid\":\"fortune\",\"name\":\"MISC Fortune\",\"images\":[]}");
        new WikiVehicleEnrichment(rest,"Test").enrich(List.of(row));
        assertThat(row.path("images").get(0).path("original_url").asText()).endsWith("fortune.jpg");
        assertThat(row.has("image_is_base")).isFalse();
        server.verify();
    }
}
