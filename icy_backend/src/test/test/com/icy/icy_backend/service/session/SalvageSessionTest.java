package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SessionRequests;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.exception.definition.BadRequestException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static com.icy.icy_backend.service.session.SessionFixture.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Fiches de salvage (docs/salvage/SPEC.md) : cargaisons, raffinage du matériau de construction, stock et étapes. */
class SalvageSessionTest {
    private final SessionFixture fixture = new SessionFixture();

    @BeforeEach
    void salvage() {
        fixture.sheet.setActivity(SessionSheet.SALVAGE);
    }

    @AfterEach
    void close() {
        fixture.close();
    }

    private static SessionRequests.RefineryOrder haul(String location, UUID recipient, SessionRequests.OrderLine... lines) {
        return new SessionRequests.RefineryOrder(null, "HAUL", null, location, null, null, null, recipient, List.of(lines));
    }

    @Test
    void salvageSheetWithoutCargoStartsAtTheSalvagingStep() {
        assertThat(SessionViewBuilder.phase(fixture.data(), NOW)).isEqualTo("SALVAGING");
    }

    @Test
    void haulIsReadyAtOnceWithoutQualityAndIsNeverAnnouncedAsARefining() {
        fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(),
                haul("Vulture de Torin", VEXA, new SessionRequests.OrderLine(RMC, 1_600, 450, "SELL")));

        assertThat(fixture.orders).singleElement().satisfies(order -> {
            assertThat(order.getKind()).isEqualTo(MiningRefineryOrder.Kind.HAUL);
            assertThat(order.isReady(NOW)).isTrue();
            assertThat(order.getReadyNotifiedAt()).isNotNull();
            assertThat(order.getTerminalId()).isNull();
            assertThat(order.getTerminalLabel()).isEqualTo("Vulture de Torin");
            assertThat(order.getLines()).singleElement().satisfies(line -> {
                assertThat(line.getCommodityName()).isEqualTo("Recycled Material Composite");
                // Le salvage n'a pas de qualité : rien n'est stocké, même si le client en envoie une.
                assertThat(line.getQuality()).isNull();
            });
        });
        assertThat(SessionViewBuilder.phase(fixture.data(), NOW)).isEqualTo("HANDOVER");
    }

    @Test
    void haulKeptByItsHolderIsAlreadyInHisStock() {
        fixture.as(VEXA).sheetService.addOrder(fixture.sheet.getId(),
                haul("Fortune de Vexa", VEXA, new SessionRequests.OrderLine(RMC, 1_400, null, "SELL")));

        assertThat(fixture.orders).singleElement().satisfies(order -> assertThat(order.isHandedOver()).isTrue());
        assertThat(MiningStock.stockOf(VEXA, fixture.orders, fixture.sales)).containsEntry(RMC, 1_400L);
        assertThat(SessionViewBuilder.phase(fixture.data(), NOW)).isEqualTo("SELLING");
    }

    @Test
    void haulNeedsALocation() {
        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(),
                haul("  ", TORIN, new SessionRequests.OrderLine(RMC, 100, null, "SELL"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("cargaison");
    }

    @Test
    void miningOreIsRefusedOnASalvageSheet() {
        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(),
                haul("Reclaimer", TORIN, new SessionRequests.OrderLine(LARANITE, 100, null, "SELL"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("salvage");
    }

    @Test
    void haulIsRefusedOnAMiningSheet() {
        fixture.sheet.setActivity(SessionSheet.MINING);

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(),
                haul("Prospector", TORIN, new SessionRequests.OrderLine(LARANITE, 100, 500, "SELL"))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void constructionMaterialRefiningNeedsNoQuality() {
        fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(), new SessionRequests.RefineryOrder(null, null, REFINERY, null, null, 4_000L, 45, VEXA,
                List.of(new SessionRequests.OrderLine(CMAT, 2_400, null, "SELL"))));

        assertThat(fixture.orders).singleElement().satisfies(order -> {
            assertThat(order.getKind()).isEqualTo(MiningRefineryOrder.Kind.REFINERY);
            assertThat(order.getFinishesAt()).isEqualTo(NOW.plusMinutes(45));
            assertThat(order.isReady(NOW)).isFalse();
        });
        assertThat(SessionViewBuilder.phase(fixture.data(), NOW)).isEqualTo("REFINING");
        assertThat(fixture.data().expenseMovements()).singleElement().satisfies(movement -> {
            assertThat(movement.userId()).isEqualTo(TORIN);
            assertThat(movement.amount()).isEqualTo(4_000L);
        });
    }

    @Test
    void refiningOrderOnlyAcceptsTheRefinedMaterial() {
        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(), new SessionRequests.RefineryOrder(null, null, REFINERY, null, null, 0L, 45, TORIN,
                List.of(new SessionRequests.OrderLine(RMC, 1_000, null, "SELL")))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("CMAT");
        assertThat(fixture.orders).isEmpty();
        assertThat(MiningMarketService.isRefinedSalvage("Construction Materials")).isTrue();
        assertThat(MiningMarketService.isRefinedSalvage("Construction Rubble")).isFalse();
        assertThat(MiningMarketService.isRefinedSalvage("Recycled Material Composite")).isFalse();
    }

    @Test
    void onlyHandedOverCargoCanBeSold() {
        fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(),
                haul("Reclaimer", VEXA, new SessionRequests.OrderLine(RMC, 10_000, null, "SELL"), new SessionRequests.OrderLine(CMAT, 500, null, "KEEP")));
        MiningRefineryOrder cargo = fixture.orders.getFirst();
        cargo.setId(UUID.randomUUID());
        SessionRequests.Sale sale = new SessionRequests.Sale(null, null, "Terra Mills HydroFarm", 89_000L, List.of(new SessionRequests.SaleLine(RMC, 1_000)));

        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addSale(fixture.sheet.getId(), sale))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("matériau");

        fixture.as(VEXA).sheetService.handOver(fixture.sheet.getId(), cargo.getId(), true);
        fixture.as(VEXA).sheetService.addSale(fixture.sheet.getId(), sale);

        assertThat(MiningStock.stockOf(VEXA, fixture.orders, fixture.sales)).containsEntry(RMC, 9_000L).doesNotContainKey(CMAT);
        assertThat(SessionViewBuilder.phase(fixture.data(), NOW)).isEqualTo("SELLING");
        // Le matériau conservé ne se vend pas.
        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addSale(fixture.sheet.getId(),
                new SessionRequests.Sale(null, null, "ARC-L1", 13_000L, List.of(new SessionRequests.SaleLine(CMAT, 100)))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void salvageSheetAcceptsADirectSaleWithoutCargo() {
        fixture.as(TORIN).sheetService.addSale(fixture.sheet.getId(),
                new SessionRequests.Sale(null, null, "Composants démontés · Area18", 42_000L, List.of()));

        assertThat(fixture.sales).singleElement().satisfies(sale -> {
            assertThat(sale.getSellerUserId()).isEqualTo(TORIN);
            assertThat(sale.getLines()).isEmpty();
        });
        assertThat(fixture.data().saleMovements()).singleElement().satisfies(movement -> assertThat(movement.amount()).isEqualTo(42_000L));
    }

    @Test
    void miningSheetStillRefusesASaleWithoutLines() {
        fixture.sheet.setActivity(SessionSheet.MINING);

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addSale(fixture.sheet.getId(),
                new SessionRequests.Sale(null, null, "Area18", 42_000L, List.of()))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void salvageSpecificExpensesAreAccepted() {
        fixture.as(KRALONE).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "CLAIM", 100_000L, "Claim Hammerhead"));
        fixture.as(VEXA).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "RENTAL", 60_000L, "Location MOTH"));

        assertThat(fixture.expenses).extracting(expense -> expense.getKind().name()).containsExactly("CLAIM", "RENTAL");
    }

    @Test
    void unknownActivityIsRefused() {
        assertThatThrownBy(() -> SessionSheetService.activity("FISHING")).isInstanceOf(BadRequestException.class);
        assertThat(SessionSheetService.activity(null)).isEqualTo("MINING");
        assertThat(SessionSheetService.activity("salvage")).isEqualTo("SALVAGE");
    }

    @Test
    void discordLinkPointsToTheSalvageSheet() {
        assertThat(MiningNotifications.path(fixture.sheet)).isEqualTo("/icy/outils/fiches-salvage/" + fixture.sheet.getId());
    }

    @Test
    void salvageMaterialsAreRecognisedByTheirUexName() {
        assertThat(MiningMarketService.isSalvageMaterial("Recycled Material Composite")).isTrue();
        assertThat(MiningMarketService.isSalvageMaterial("Construction Materials")).isTrue();
        assertThat(MiningMarketService.isSalvageMaterial("Construction Rubble")).isTrue();
        assertThat(MiningMarketService.isSalvageMaterial("Quantanium")).isFalse();
    }
}
