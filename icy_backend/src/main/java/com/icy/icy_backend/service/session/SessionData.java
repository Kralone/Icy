package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.session.SessionExpense;
import com.icy.icy_backend.db.entity.session.SessionParticipant;
import com.icy.icy_backend.db.entity.session.SessionSale;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSheet;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Contenu d'une fiche, chargé en une fois pour le calcul et l'affichage. */
public record SessionData(
        SessionSheet sheet,
        List<SessionParticipant> participants,
        List<SessionExpense> expenses,
        List<MiningRefineryOrder> orders,
        List<SessionSale> sales,
        Optional<SessionSettlement> settlement
) {
    public boolean isParticipant(UUID userId) {
        return participants.stream().anyMatch(participant -> Objects.equals(participant.getUserId(), userId));
    }

    public Optional<SessionParticipant> participant(UUID userId) {
        return participants.stream().filter(participant -> Objects.equals(participant.getUserId(), userId)).findFirst();
    }

    /** Frais avancés : frais déclarés et coût des ordres de raffinage, chacun au nom de son payeur. */
    public List<SettlementCalculator.Movement> expenseMovements() {
        List<SettlementCalculator.Movement> movements = new ArrayList<>();
        expenses.forEach(expense -> movements.add(new SettlementCalculator.Movement(expense.getPayerUserId(), expense.getAmount())));
        orders.stream().filter(order -> order.getCost() > 0)
                .forEach(order -> movements.add(new SettlementCalculator.Movement(order.getLauncherUserId(), order.getCost())));
        return movements;
    }

    public List<SettlementCalculator.Movement> saleMovements() {
        return sales.stream().map(sale -> new SettlementCalculator.Movement(sale.getSellerUserId(), sale.getAmount())).toList();
    }

    public List<SettlementCalculator.Member> members() {
        return participants.stream().map(participant -> new SettlementCalculator.Member(participant.getUserId(), participant.getSharesCenti())).toList();
    }

    public SettlementCalculator.Result preview() {
        return SettlementCalculator.settle(members(), expenseMovements(), saleMovements());
    }

    /** Total « à vendre » par minerai, toutes remises confondues. */
    public long totalToSell(int commodityId) {
        return orders.stream().flatMap(order -> order.getLines().stream())
                .filter(line -> line.getDestination() == MiningRefineryOrderLine.Destination.SELL && line.getCommodityId() == commodityId)
                .mapToLong(MiningRefineryOrderLine::getQuantityCscu).sum();
    }
}
