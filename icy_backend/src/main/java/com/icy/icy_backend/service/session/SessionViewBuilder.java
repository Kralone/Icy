package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SessionSheetDTO;
import com.icy.icy_backend.controller.dto.session.SessionSheetDTO.UserRef;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.session.SessionSale;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSettlementTransfer;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.session.SessionHistoryRepository;
import com.icy.icy_backend.db.repository.session.SessionSettlementRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Construit la vue d'une fiche : étape, stocks, reste à vendre, partage et droits du lecteur. */
@Component
@RequiredArgsConstructor
public class SessionViewBuilder {
    private final UserRepository users;
    private final EventRepository events;
    private final SessionHistoryRepository history;
    private final SessionSettlementRepository settlements;

    /**
     * Étape affichée : la plus en amont qui n'est pas terminée.
     * MINING (aucun ordre), REFINING (un ordre n'est pas prêt), HANDOVER (un ordre prêt n'est pas remis),
     * SELLING, puis PAYMENTS (comptes arrêtés) et DONE (fiche close).
     */
    public static String phase(SessionData data, LocalDateTime now) {
        SessionSheet sheet = data.sheet();
        if (sheet.getStatus() == SessionSheet.Status.SETTLEMENT) return "PAYMENTS";
        if (sheet.getStatus() == SessionSheet.Status.CLOSED) return "DONE";
        if (data.orders().isEmpty()) return "MINING";
        if (data.orders().stream().anyMatch(order -> !order.isReady(now))) return "REFINING";
        if (data.orders().stream().anyMatch(order -> !order.isHandedOver())) return "HANDOVER";
        return "SELLING";
    }

    public SessionSheetDTO build(SessionData data, UUID viewerId, boolean viewerIsOrganizer, LocalDateTime now) {
        SessionSheet sheet = data.sheet();
        Map<UUID, UserRef> refs = userRefs(data);
        Function<UUID, UserRef> ref = id -> id == null ? null : refs.getOrDefault(id, new UserRef(id, "Membre inconnu", null));
        boolean participant = data.isParticipant(viewerId);
        boolean active = sheet.getStatus() == SessionSheet.Status.ACTIVE;
        boolean canEdit = active && (participant || viewerIsOrganizer);

        Set<UUID> sellers = new LinkedHashSet<>();
        data.orders().forEach(order -> sellers.add(order.getRecipientUserId()));
        data.sales().forEach(sale -> sellers.add(sale.getSellerUserId()));

        List<SessionSheetDTO.Participant> participants = data.participants().stream()
                .map(p -> new SessionSheetDTO.Participant(ref.apply(p.getUserId()), p.getSharesCenti(), p.getJoinedAt(), sellers.contains(p.getUserId())))
                .toList();
        List<SessionSheetDTO.Expense> expenses = data.expenses().stream()
                .map(e -> new SessionSheetDTO.Expense(e.getId(), ref.apply(e.getPayerUserId()), e.getKind().name(), e.getAmount(), e.getNote(), e.getCreatedAt(),
                        active && (viewerIsOrganizer || Objects.equals(e.getPayerUserId(), viewerId))))
                .toList();
        List<SessionSheetDTO.Order> orders = data.orders().stream().map(o -> new SessionSheetDTO.Order(
                o.getId(), ref.apply(o.getLauncherUserId()), o.getTerminalId(), o.getTerminalLabel(), o.getMethodCode(), o.getMethodLabel(),
                o.getCost(), o.getFinishesAt(), o.isReady(now), ref.apply(o.getRecipientUserId()), o.getHandedOverAt(),
                o.getLines().stream().map(l -> new SessionSheetDTO.OrderLine(l.getCommodityId(), l.getCommodityName(), l.getQuantityCscu(), l.getQuality(), l.getDestination().name())).toList(),
                active && (viewerIsOrganizer || Objects.equals(o.getLauncherUserId(), viewerId)),
                active && (viewerIsOrganizer || Objects.equals(o.getLauncherUserId(), viewerId) || Objects.equals(o.getRecipientUserId(), viewerId))
        )).toList();
        List<SessionSheetDTO.Sale> sales = data.sales().stream().map(s -> new SessionSheetDTO.Sale(
                s.getId(), ref.apply(s.getSellerUserId()), s.getTerminalId(), s.getTerminalLabel(), s.getAmount(), s.getSoldAt(),
                s.getLines().stream().map(l -> new SessionSheetDTO.SaleLine(l.getCommodityId(), l.getCommodityName(), l.getQuantityCscu())).toList(),
                active && (viewerIsOrganizer || Objects.equals(s.getSellerUserId(), viewerId))
        )).toList();

        Event event = sheet.getOperationEventId() == null ? null : events.findById(sheet.getOperationEventId()).orElse(null);
        LocalDateTime lastFinish = data.orders().stream().map(MiningRefineryOrder::getFinishesAt).max(Comparator.naturalOrder()).orElse(null);
        return new SessionSheetDTO(
                sheet.getId(), sheet.getName(), sheet.getSessionDate(), sheet.getStatus().name(), phase(data, now), sheet.getRevision(),
                ref.apply(sheet.getOrganizerUserId()), sheet.getOperationEventId(), event == null ? null : event.getTitle(),
                new SessionSheetDTO.Permissions(viewerId, viewerIsOrganizer, participant, canEdit),
                participants, expenses, orders, sales, stock(data, sellers, ref), remaining(data), share(data, ref),
                history.findBySheetIdOrderByAtDesc(sheet.getId()).stream()
                        .map(h -> new SessionSheetDTO.History(h.getAction().name(), ref.apply(h.getActorUserId()), h.getReason(), h.getAt())).toList(),
                settlements.findCancelled(sheet.getId()).stream().map(s -> new SessionSheetDTO.CancelledSettlement(
                        s.getId(), s.getCreatedAt(), s.getCancelledAt(), ref.apply(s.getCancelledByUserId()), s.getTotalSales(), s.getTotalExpenses(), s.getNet(),
                        transfers(s, ref))).toList(),
                lastFinish, now);
    }

    private List<SessionSheetDTO.Stock> stock(SessionData data, Set<UUID> sellers, Function<UUID, UserRef> ref) {
        Map<Integer, String> names = commodityNames(data);
        List<SessionSheetDTO.Stock> result = new ArrayList<>();
        for (UUID seller : sellers) {
            Map<Integer, Long> inStock = MiningStock.stockOf(seller, data.orders(), data.sales());
            Map<Integer, Long> awaiting = new LinkedHashMap<>();
            data.orders().stream().filter(o -> Objects.equals(o.getRecipientUserId(), seller) && !o.isHandedOver())
                    .flatMap(o -> o.getLines().stream())
                    .filter(l -> l.getDestination() == MiningRefineryOrderLine.Destination.SELL)
                    .forEach(l -> awaiting.merge(l.getCommodityId(), (long) l.getQuantityCscu(), Long::sum));
            Set<Integer> commodities = new LinkedHashSet<>(inStock.keySet());
            commodities.addAll(awaiting.keySet());
            List<SessionSheetDTO.StockLine> lines = commodities.stream()
                    .map(id -> new SessionSheetDTO.StockLine(id, names.getOrDefault(id, "Minerai " + id), Math.max(0, inStock.getOrDefault(id, 0L)), awaiting.getOrDefault(id, 0L)))
                    .filter(line -> line.inStockCscu() > 0 || line.awaitingCscu() > 0)
                    .toList();
            result.add(new SessionSheetDTO.Stock(ref.apply(seller), lines));
        }
        return result;
    }

    private List<SessionSheetDTO.Remaining> remaining(SessionData data) {
        Map<Integer, String> names = commodityNames(data);
        Map<Integer, Long> sold = new LinkedHashMap<>();
        data.sales().forEach(sale -> sale.getLines().forEach(line -> sold.merge(line.getCommodityId(), (long) line.getQuantityCscu(), Long::sum)));
        Set<Integer> commodities = new LinkedHashSet<>();
        data.orders().forEach(o -> o.getLines().stream().filter(l -> l.getDestination() == MiningRefineryOrderLine.Destination.SELL)
                .forEach(l -> commodities.add(l.getCommodityId())));
        return commodities.stream().map(id -> {
            long total = data.totalToSell(id);
            long soldCscu = sold.getOrDefault(id, 0L);
            return new SessionSheetDTO.Remaining(id, names.getOrDefault(id, "Minerai " + id), total, soldCscu, Math.max(0, total - soldCscu));
        }).toList();
    }

    private SessionSheetDTO.Share share(SessionData data, Function<UUID, UserRef> ref) {
        int totalCenti = data.participants().stream().mapToInt(p -> p.getSharesCenti()).sum();
        SessionSettlement settlement = data.settlement().orElse(null);
        if (data.sheet().getStatus() != SessionSheet.Status.ACTIVE && settlement != null) {
            List<SessionSheetDTO.ShareRow> rows = settlement.getShares().stream()
                    .map(s -> new SessionSheetDTO.ShareRow(ref.apply(s.getUserId()), s.getSharesCenti(), s.getShare(), s.getAdvanced(), s.getCashed(), s.getBalance(), s.getBalance() - s.getCashed()))
                    .toList();
            int settledCenti = settlement.getShares().stream().mapToInt(s -> s.getSharesCenti()).sum();
            return new SessionSheetDTO.Share("SETTLEMENT", settlement.getTotalSales(), settlement.getTotalExpenses(), settlement.getNet(), settledCenti, rows, transfers(settlement, ref),
                    new SessionSheetDTO.Settlement(settlement.getId(), settlement.getCreatedAt(), ref.apply(settlement.getCreatedByUserId()),
                            settlement.getClosedAt(), settlement.getCloseKind() == null ? null : settlement.getCloseKind().name(), settlement.getCloseReason()));
        }
        long totalSales = data.sales().stream().mapToLong(SessionSale::getAmount).sum();
        long totalExpenses = data.expenseMovements().stream().mapToLong(SettlementCalculator.Movement::amount).sum();
        // Avant la première vente, aucun solde : il ferait apparaître un faux déficit. Seuls les frais avancés sont montrés.
        if (totalSales == 0 || totalCenti == 0) {
            Map<UUID, Long> advanced = new LinkedHashMap<>();
            data.expenseMovements().forEach(m -> advanced.merge(m.userId(), m.amount(), Long::sum));
            List<SessionSheetDTO.ShareRow> rows = data.participants().stream()
                    .map(p -> new SessionSheetDTO.ShareRow(ref.apply(p.getUserId()), p.getSharesCenti(), 0, advanced.getOrDefault(p.getUserId(), 0L), 0, 0, 0))
                    .toList();
            return new SessionSheetDTO.Share("NONE", totalSales, totalExpenses, totalSales - totalExpenses, totalCenti, rows, List.of(), null);
        }
        SettlementCalculator.Result result = data.preview();
        List<SessionSheetDTO.ShareRow> rows = result.rows().stream()
                .map(r -> new SessionSheetDTO.ShareRow(ref.apply(r.userId()), r.sharesCenti(), r.share(), r.advanced(), r.cashed(), r.balance(), r.gap()))
                .toList();
        List<SessionSheetDTO.Transfer> transfers = result.transfers().stream()
                .map(t -> new SessionSheetDTO.Transfer(null, ref.apply(t.fromUserId()), ref.apply(t.toUserId()), t.amount(), null, null))
                .toList();
        return new SessionSheetDTO.Share("PREVIEW", result.totalSales(), result.totalExpenses(), result.net(), totalCenti, rows, transfers, null);
    }

    private static List<SessionSheetDTO.Transfer> transfers(SessionSettlement settlement, Function<UUID, UserRef> ref) {
        return settlement.getTransfers().stream().sorted(Comparator.comparingInt(SessionSettlementTransfer::getPosition))
                .map(t -> new SessionSheetDTO.Transfer(t.getId(), ref.apply(t.getFromUserId()), ref.apply(t.getToUserId()), t.getAmount(), t.getReceivedAt(), ref.apply(t.getReceivedByUserId())))
                .toList();
    }

    private static Map<Integer, String> commodityNames(SessionData data) {
        Map<Integer, String> names = new LinkedHashMap<>();
        data.orders().forEach(o -> o.getLines().forEach(l -> names.putIfAbsent(l.getCommodityId(), l.getCommodityName())));
        data.sales().forEach(s -> s.getLines().forEach(l -> names.putIfAbsent(l.getCommodityId(), l.getCommodityName())));
        return names;
    }

    private Map<UUID, UserRef> userRefs(SessionData data) {
        Set<UUID> ids = new HashSet<>();
        ids.add(data.sheet().getOrganizerUserId());
        data.participants().forEach(p -> ids.add(p.getUserId()));
        data.expenses().forEach(e -> ids.add(e.getPayerUserId()));
        data.orders().forEach(o -> { ids.add(o.getLauncherUserId()); ids.add(o.getRecipientUserId()); });
        data.sales().forEach(s -> ids.add(s.getSellerUserId()));
        history.findBySheetIdOrderByAtDesc(data.sheet().getId()).forEach(h -> ids.add(h.getActorUserId()));
        data.settlement().ifPresent(s -> {
            ids.add(s.getCreatedByUserId());
            s.getTransfers().forEach(t -> { ids.add(t.getFromUserId()); ids.add(t.getToUserId()); if (t.getReceivedByUserId() != null) ids.add(t.getReceivedByUserId()); });
        });
        settlements.findCancelled(data.sheet().getId()).forEach(s -> {
            ids.add(s.getCreatedByUserId());
            if (s.getCancelledByUserId() != null) ids.add(s.getCancelledByUserId());
            s.getTransfers().forEach(t -> { ids.add(t.getFromUserId()); ids.add(t.getToUserId()); if (t.getReceivedByUserId() != null) ids.add(t.getReceivedByUserId()); });
        });
        ids.remove(null);
        return users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, u -> new UserRef(u.getId(), u.getUsername(), u.getAvatarUrl())));
    }
}
