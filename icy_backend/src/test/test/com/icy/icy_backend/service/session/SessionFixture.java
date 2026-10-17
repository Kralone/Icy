package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.session.SessionExpense;
import com.icy.icy_backend.db.entity.session.SessionParticipant;
import com.icy.icy_backend.db.entity.session.SessionSale;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSettlementTransfer;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.session.MiningRefineryOrderRepository;
import com.icy.icy_backend.db.repository.session.SessionExpenseRepository;
import com.icy.icy_backend.db.repository.session.SessionHistoryRepository;
import com.icy.icy_backend.db.repository.session.SessionParticipantRepository;
import com.icy.icy_backend.db.repository.session.SessionSaleRepository;
import com.icy.icy_backend.db.repository.session.SessionSettlementRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.security.AuthUtils;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Montage commun des tests de service : dépôts simulés, fiche en mémoire, utilisateur et rôles contrôlés.
 * Kralone organise ; Vexa et Torin participent ; Xeno n'est pas sur la fiche.
 */
class SessionFixture implements AutoCloseable {
    static final UUID KRALONE = new UUID(0, 1);
    static final UUID VEXA = new UUID(0, 2);
    static final UUID TORIN = new UUID(0, 3);
    static final UUID XENO = new UUID(0, 9);
    static final int LARANITE = 47;
    static final int REFINERY = 236;
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 22, 22, 0);

    final SessionSheetRepository sheets = Mockito.mock(SessionSheetRepository.class);
    final SessionParticipantRepository participantRepository = Mockito.mock(SessionParticipantRepository.class);
    final SessionExpenseRepository expenseRepository = Mockito.mock(SessionExpenseRepository.class);
    final MiningRefineryOrderRepository orderRepository = Mockito.mock(MiningRefineryOrderRepository.class);
    final SessionSaleRepository saleRepository = Mockito.mock(SessionSaleRepository.class);
    final SessionSettlementRepository settlementRepository = Mockito.mock(SessionSettlementRepository.class);
    final SessionHistoryRepository historyRepository = Mockito.mock(SessionHistoryRepository.class);
    final UserRepository users = Mockito.mock(UserRepository.class);
    final SessionLoader loader = Mockito.mock(SessionLoader.class);
    final SessionViewBuilder views = Mockito.mock(SessionViewBuilder.class);
    final MiningMarketService market = Mockito.mock(MiningMarketService.class);
    final SessionEvents events = Mockito.mock(SessionEvents.class);
    final MiningNotifications notifications = Mockito.mock(MiningNotifications.class);

    final SessionSheet sheet = SessionSheet.builder().id(UUID.randomUUID()).name("Quanta du jeudi").sessionDate(LocalDate.of(2026, 10, 22))
            .organizerUserId(KRALONE).createdAt(NOW).updatedAt(NOW).build();
    final List<SessionParticipant> participants = new ArrayList<>();
    final List<SessionExpense> expenses = new ArrayList<>();
    final List<MiningRefineryOrder> orders = new ArrayList<>();
    final List<SessionSale> sales = new ArrayList<>();
    final List<SessionSettlement> settlements = new ArrayList<>();

    final SessionSheetService sheetService;
    final SessionSettlementService settlementService;

    private final MockedStatic<AuthUtils> auth = Mockito.mockStatic(AuthUtils.class);
    private UUID actor = KRALONE;
    private final Set<String> roles = new HashSet<>();

    SessionFixture() {
        participant(KRALONE, 100);
        participant(VEXA, 100);
        participant(TORIN, 100);
        sheetService = new SessionSheetService(sheets, participantRepository, expenseRepository, orderRepository, saleRepository, users, loader, views, market, events);
        sheetService.setClock(Clock.fixed(NOW.atZone(ZoneId.of("Europe/Paris")).toInstant(), ZoneId.of("Europe/Paris")));
        settlementService = new SessionSettlementService(sheets, settlementRepository, historyRepository, loader, sheetService, events, notifications);

        auth.when(AuthUtils::getCurrentUserId).thenAnswer(invocation -> actor);
        auth.when(AuthUtils::isAdmin).thenAnswer(invocation -> roles.contains("ADMIN"));
        auth.when(() -> AuthUtils.hasRole(any())).thenAnswer(invocation -> roles.contains(invocation.<String>getArgument(0)));

        when(loader.lock(sheet.getId())).thenAnswer(invocation -> data());
        when(loader.read(sheet.getId())).thenAnswer(invocation -> data());
        when(sheets.save(any(SessionSheet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(expenseRepository.save(any(SessionExpense.class))).thenAnswer(invocation -> keep(expenses, invocation.getArgument(0)));
        when(orderRepository.save(any(MiningRefineryOrder.class))).thenAnswer(invocation -> keep(orders, invocation.getArgument(0)));
        when(saleRepository.save(any(SessionSale.class))).thenAnswer(invocation -> keep(sales, invocation.getArgument(0)));
        when(participantRepository.save(any(SessionParticipant.class))).thenAnswer(invocation -> keep(participants, invocation.getArgument(0)));
        when(settlementRepository.save(any(SessionSettlement.class))).thenAnswer(invocation -> {
            SessionSettlement settlement = invocation.getArgument(0);
            if (settlement.getId() == null) settlement.setId(UUID.randomUUID());
            for (SessionSettlementTransfer transfer : settlement.getTransfers()) if (transfer.getId() == null) transfer.setId(UUID.randomUUID());
            if (!settlements.contains(settlement)) settlements.add(settlement);
            return settlement;
        });
        Mockito.doAnswer(invocation -> sales.remove(invocation.<SessionSale>getArgument(0))).when(saleRepository).delete(any(SessionSale.class));
        Mockito.doAnswer(invocation -> orders.remove(invocation.<MiningRefineryOrder>getArgument(0))).when(orderRepository).delete(any(MiningRefineryOrder.class));
        when(market.terminals()).thenReturn(Map.of(REFINERY, new MiningMarketService.Terminal(REFINERY, "CRU-L1 Ambitious Dream Station", "Stanton › Crusader", "Stanton", true)));
        when(market.commodities()).thenReturn(Map.of(LARANITE, new MiningMarketService.Commodity(LARANITE, "Laranite", "LARA")));
        when(market.methods()).thenReturn(List.of());
        when(users.findAllById(any())).thenAnswer(invocation -> {
            List<User> found = new ArrayList<>();
            for (Object id : (Iterable<?>) invocation.getArgument(0)) {
                User user = new User();
                user.setId((UUID) id);
                user.setUsername("u" + id);
                found.add(user);
            }
            return found;
        });
    }

    SessionFixture as(UUID user, String... userRoles) {
        actor = user;
        roles.clear();
        roles.addAll(List.of(userRoles));
        return this;
    }

    SessionData data() {
        Optional<SessionSettlement> current = settlements.stream().filter(s -> s.getCancelledAt() == null).findFirst();
        return new SessionData(sheet, participants, expenses, orders, sales, current);
    }

    void participant(UUID userId, int centi) {
        participants.add(SessionParticipant.builder().id(UUID.randomUUID()).sheetId(sheet.getId()).userId(userId).sharesCenti(centi)
                .joinedAt(NOW.minusHours(3).plusMinutes(participants.size())).build());
    }

    /** Ordre prêt contenant une ligne de Laranite à vendre. */
    MiningRefineryOrder order(UUID launcher, UUID recipient, int cscu, boolean handedOver) {
        MiningRefineryOrder order = MiningRefineryOrder.builder().id(UUID.randomUUID()).sheetId(sheet.getId()).launcherUserId(launcher)
                .recipientUserId(recipient).terminalId(REFINERY).terminalLabel("CRU-L1").cost(0).finishesAt(NOW.minusHours(1))
                .handedOverAt(handedOver ? NOW.minusMinutes(30) : null).createdAt(NOW.minusHours(2)).build();
        order.getLines().add(MiningRefineryOrderLine.builder().order(order).commodityId(LARANITE).commodityName("Laranite")
                .quantityCscu(cscu).quality(700).destination(MiningRefineryOrderLine.Destination.SELL).build());
        orders.add(order);
        return order;
    }

    SessionSale sale(UUID seller, long amount, int laraniteCscu) {
        SessionSale sale = SessionSale.builder().id(UUID.randomUUID()).sheetId(sheet.getId()).sellerUserId(seller).terminalLabel("Area18").amount(amount).soldAt(NOW).build();
        sale.getLines().add(com.icy.icy_backend.db.entity.mining.MiningSaleLine.builder().sale(sale).commodityId(LARANITE).commodityName("Laranite").quantityCscu(laraniteCscu).build());
        sales.add(sale);
        return sale;
    }

    void expense(UUID payer, long amount) {
        expenses.add(SessionExpense.builder().id(UUID.randomUUID()).sheetId(sheet.getId()).payerUserId(payer).kind(SessionExpense.Kind.FUEL).amount(amount).createdAt(NOW).build());
    }

    SessionSettlement current() {
        return settlements.stream().filter(s -> s.getCancelledAt() == null).findFirst().orElseThrow();
    }

    private static <T> T keep(List<T> list, T value) {
        if (!list.contains(value)) list.add(value);
        return value;
    }

    @Override
    public void close() {
        auth.close();
    }

    static Instant instant(LocalDateTime time) {
        return time.atZone(ZoneId.of("Europe/Paris")).toInstant();
    }
}
