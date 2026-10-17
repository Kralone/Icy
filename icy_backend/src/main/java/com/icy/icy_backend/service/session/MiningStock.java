package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.mining.MiningSaleLine;
import com.icy.icy_backend.db.entity.session.SessionSale;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Stock de chaque vendeur, en cSCU par minerai (docs/mining-v3/SPEC.md, « Stock de chaque vendeur ») :
 * lignes « à vendre » des ordres remis au vendeur, moins ce qu'il a déjà vendu. Les minerais conservés n'y entrent jamais.
 */
public final class MiningStock {
    private MiningStock() {
    }

    public record Line(int commodityId, int quantityCscu) {
    }

    /** Ligne refusée : quantité cumulée demandée pour un minerai et quantité disponible. */
    public record Shortage(int commodityId, long wanted, long available) {
    }

    public static Map<Integer, Long> stockOf(UUID sellerId, Collection<MiningRefineryOrder> orders, Collection<SessionSale> sales) {
        Map<Integer, Long> stock = new LinkedHashMap<>();
        for (MiningRefineryOrder order : orders) {
            if (!Objects.equals(order.getRecipientUserId(), sellerId) || !order.isHandedOver()) continue;
            for (MiningRefineryOrderLine line : order.getLines()) {
                if (line.getDestination() != MiningRefineryOrderLine.Destination.SELL) continue;
                stock.merge(line.getCommodityId(), (long) line.getQuantityCscu(), Long::sum);
            }
        }
        for (SessionSale sale : sales) {
            if (!Objects.equals(sale.getSellerUserId(), sellerId)) continue;
            for (MiningSaleLine line : sale.getLines()) stock.merge(line.getCommodityId(), (long) -line.getQuantityCscu(), Long::sum);
        }
        return stock;
    }

    /**
     * Les lignes d'un même minerai sont cumulées avant la comparaison au stock :
     * deux lignes de 70 cSCU face à un stock de 100 sont refusées. Liste vide : la vente tient dans le stock.
     */
    public static List<Shortage> shortages(List<Line> lines, Map<Integer, Long> stock) {
        Map<Integer, Long> wanted = new LinkedHashMap<>();
        for (Line line : lines) wanted.merge(line.commodityId(), (long) line.quantityCscu(), Long::sum);
        return wanted.entrySet().stream()
                .filter(entry -> entry.getValue() > stock.getOrDefault(entry.getKey(), 0L))
                .map(entry -> new Shortage(entry.getKey(), entry.getValue(), Math.max(0L, stock.getOrDefault(entry.getKey(), 0L))))
                .toList();
    }

    /** Un stock sous zéro signifie qu'une modification retirerait du minerai déjà vendu. */
    public static boolean anyNegative(Map<Integer, Long> stock) {
        return stock.values().stream().anyMatch(quantity -> quantity < 0);
    }
}
