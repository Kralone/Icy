package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.config.WikeloProperties;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class WikeloServiceTest {

    @Test
    void importsCompleteIdrisRecipeFromMultilineCellsAndNamedContinuation() throws Exception {
        String csv = new String(getClass().getResourceAsStream("/wikelo/ships-current.csv").readAllBytes(),
                java.nio.charset.StandardCharsets.UTF_8);
        var ships = sourceService(csv).scrapeShips();
        assertThat(ships).hasSize(34);
        var idris = ships.stream().filter(ship -> ship.getShipName().equals("Idris-P")).findFirst().orElseThrow();
        assertThat(idris.getCostText().split(" \\| ")).containsExactly(
                "50x Wikelo Favor", "50x Polaris Bit", "50x DCHS-05 Orbital Positioning Comp-Board",
                "50x Carinite", "50x Irradiated Valakkar Fang (Apex)", "50x MG Scrip",
                "50x Ace Interceptor Helmet", "30x Irradiated Valakkar Pearl (Grade AAA)",
                "30x UEE 6th Platoon Medal (Pristine)", "30x Carinite (Pure)", "30x ASD Secure Drive",
                "5x RCMBNT-PWL-1", "5x RCMBNT-PWL-2", "5x RCMBNT-PWL-3",
                "5x RCMBNT-RGL-1", "5x RCMBNT-RGL-2", "5x RCMBNT-RGL-3",
                "5x RCMBNT-XTL-1", "5x RCMBNT-XTL-2", "5x RCMBNT-XTL-3");
        assertThat(idris.getCostText()).startsWith("50x Wikelo Favor | 50x Polaris Bit")
                .contains("50x Carinite", "30x Carinite (Pure)", "50x MG Scrip", "30x ASD Secure Drive")
                .endsWith("5x RCMBNT-XTL-3").doesNotContain("Continued", "Reputation", "15x");
        assertThat(idris.getReputationText()).startsWith("Very Best Customer (999 Reputation)")
                .doesNotContain("Cost:", "Polaris");
        assertThatThrownBy(() -> sourceService(csv.replace("Idris Costs Continued:", "Unrelated Costs Continued:")).scrapeShips())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Suite de recette Wikelo");
    }

    @Test
    void separatesCostAndReputationWithoutIncludingOtherMetadata() {
        var ship = sourceService("Ship,#,Component\n\"Mission: Test\nCost: 2x Favor\n3x Ore\nReputation: Friend\",,\n")
                .scrapeShips().getFirst();
        assertThat(ship.getCostText()).isEqualTo("2x Favor | 3x Ore");
        assertThat(ship.getReputationText()).isEqualTo("Friend");
    }

    @Test
    void keepsAllInternalModulesWhenExecutiveFitExceedsFourteenRows() {
        StringBuilder csv = new StringBuilder("PYAM Exec,#,Component,,,,\n");
        for (int i = 1; i <= 16; i++) {
            csv.append("Module:,1x,Internal-").append(i).append(",1,Civilian,A\n");
        }
        csv.append("Mission: PYAM - Cost: 1x Favor,,,,,,\n");
        csv.append("Next ship,#,Component,,,,\n");
        var ship = sourceService(csv.toString()).scrapeShips().stream()
                .filter(value -> value.getShipName().equals("PYAM Exec")).findFirst().orElseThrow();
        assertThat(ship.getComponentsText()).contains("Internal-1", "Internal-16")
                .doesNotContain("Next ship");
    }

    private WikeloService sourceService(String csv) {
        var properties = new WikeloProperties();
        properties.setSpreadsheetId("test");
        properties.setShipsGid(1L);
        return new WikeloService(Mockito.mock(WikeloShipRepository.class), properties, Mockito.mock(MessageService.class)) {
            @Override String fetchCsv(String url) { return csv; }
        };
    }

    @Test
    void exportsRawRowsWithoutMergingCreditsIntoShipNames() {
        WikeloProperties properties = new WikeloProperties();
        properties.setSpreadsheetId("sheet-id");
        properties.setShipsGid(1L);
        WikeloService service = new WikeloService(Mockito.mock(WikeloShipRepository.class), properties,
                Mockito.mock(MessageService.class)) {
            @Override
            String fetchCsv(String csvUrl) {
                assertThat(csvUrl).contains("headers=0");
                return "\"Components based on Datamining by Contributor\",\"\",\"\"\n"
                        + "\"Golem\",\"#\",\"Component\"\n"
                        + "\"Mission: Golem Rocks - Cost: 2x Wikelo Favor\",\"\",\"\"\n";
            }
        };
        assertThat(service.scrapeShips()).singleElement().satisfies(ship -> {
            assertThat(ship.getShipName()).isEqualTo("Golem");
            assertThat(ship.getCostText()).isEqualTo("2x Wikelo Favor");
        });
        properties.setShipsGid(null);
        properties.setShipsSheetName("Ships");
        assertThat(service.scrapeShips()).singleElement().satisfies(ship ->
                assertThat(ship.getShipName()).isEqualTo("Golem"));
    }

    @Test
    void rescrapeKeepsPublishedRowsWhenSourceIsEmpty() {
        WikeloShipRepository repository = Mockito.mock(WikeloShipRepository.class);
        WikeloProperties properties = new WikeloProperties();
        properties.setSpreadsheetId("sheet-id");
        properties.setShipsGid(1L);
        MessageService messageService = Mockito.mock(MessageService.class);

        WikeloService service = new WikeloService(repository, properties, messageService) {
            @Override
            String fetchCsv(String csvUrl) {
                return "";
            }
        };

        assertThatThrownBy(service::rescrapeShips)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("donnees publiees sont conservees");

        verify(repository, never()).deleteAllInBatch();
    }
}
