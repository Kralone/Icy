package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.mining.MiningSaleLine;
import com.icy.icy_backend.db.entity.session.SessionSale;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MiningStockTest {
    static final int LARANITE = 47;
    static final int GOLD = 33;
    static final UUID VEXA = new UUID(0, 1);
    static final UUID KRALONE = new UUID(0, 2);

    @Test
    void stockCountsHandedOverSellLinesMinusSales() {
        List<MiningRefineryOrder> orders = List.of(
                order(VEXA, true, line(LARANITE, 1480, MiningRefineryOrderLine.Destination.SELL), line(GOLD, 230, MiningRefineryOrderLine.Destination.KEEP)),
                order(VEXA, false, line(LARANITE, 500, MiningRefineryOrderLine.Destination.SELL)),
                order(KRALONE, true, line(LARANITE, 900, MiningRefineryOrderLine.Destination.SELL)));
        List<SessionSale> sales = List.of(sale(VEXA, LARANITE, 1000));

        Map<Integer, Long> stock = MiningStock.stockOf(VEXA, orders, sales);

        assertThat(stock).containsEntry(LARANITE, 480L).doesNotContainKey(GOLD);
    }

    @Test
    void linesOfTheSameCommodityAreCumulatedBeforeTheCheck() {
        Map<Integer, Long> stock = Map.of(LARANITE, 100L);

        assertThat(MiningStock.shortages(List.of(new MiningStock.Line(LARANITE, 70), new MiningStock.Line(LARANITE, 70)), stock))
                .containsExactly(new MiningStock.Shortage(LARANITE, 140, 100));
        assertThat(MiningStock.shortages(List.of(new MiningStock.Line(LARANITE, 50), new MiningStock.Line(LARANITE, 50)), stock)).isEmpty();
    }

    @Test
    void readyButNotHandedOverOrderIsNotSellableEvenByItsLauncher() {
        MiningRefineryOrder own = order(KRALONE, false, line(LARANITE, 1840, MiningRefineryOrderLine.Destination.SELL));
        own.setLauncherUserId(KRALONE);

        Map<Integer, Long> stock = MiningStock.stockOf(KRALONE, List.of(own), List.of());

        assertThat(MiningStock.shortages(List.of(new MiningStock.Line(LARANITE, 1)), stock)).hasSize(1);
    }

    @Test
    void keptOresCannotBeSold() {
        Map<Integer, Long> stock = MiningStock.stockOf(VEXA, List.of(order(VEXA, true, line(GOLD, 230, MiningRefineryOrderLine.Destination.KEEP))), List.of());

        assertThat(MiningStock.shortages(List.of(new MiningStock.Line(GOLD, 1)), stock)).hasSize(1);
    }

    @Test
    void negativeStockIsDetected() {
        assertThat(MiningStock.anyNegative(Map.of(LARANITE, -1L))).isTrue();
        assertThat(MiningStock.anyNegative(Map.of(LARANITE, 0L))).isFalse();
    }

    static MiningRefineryOrder order(UUID recipient, boolean handedOver, MiningRefineryOrderLine... lines) {
        MiningRefineryOrder order = MiningRefineryOrder.builder().id(UUID.randomUUID()).recipientUserId(recipient).launcherUserId(recipient)
                .finishesAt(LocalDateTime.of(2026, 10, 22, 21, 0)).handedOverAt(handedOver ? LocalDateTime.of(2026, 10, 22, 22, 0) : null).build();
        for (MiningRefineryOrderLine line : lines) {
            line.setOrder(order);
            order.getLines().add(line);
        }
        return order;
    }

    static MiningRefineryOrderLine line(int commodity, int cscu, MiningRefineryOrderLine.Destination destination) {
        return MiningRefineryOrderLine.builder().commodityId(commodity).commodityName("C" + commodity).quantityCscu(cscu).quality(500).destination(destination).build();
    }

    static SessionSale sale(UUID seller, int commodity, int cscu) {
        SessionSale sale = SessionSale.builder().id(UUID.randomUUID()).sellerUserId(seller).amount(1).terminalLabel("T").build();
        sale.getLines().add(MiningSaleLine.builder().sale(sale).commodityId(commodity).commodityName("C" + commodity).quantityCscu(cscu).build());
        return sale;
    }
}
