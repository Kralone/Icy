package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SessionRequests;
import com.icy.icy_backend.controller.dto.session.SessionSheetDTO;
import com.icy.icy_backend.controller.dto.session.SessionSummaryDTO;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.mining.MiningSaleLine;
import com.icy.icy_backend.db.entity.session.SessionExpense;
import com.icy.icy_backend.db.entity.session.SessionParticipant;
import com.icy.icy_backend.db.entity.session.SessionSale;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.session.MiningRefineryOrderRepository;
import com.icy.icy_backend.db.repository.session.SessionExpenseRepository;
import com.icy.icy_backend.db.repository.session.SessionParticipantRepository;
import com.icy.icy_backend.db.repository.session.SessionSaleRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fiches de session : création, participants, frais, lots de cargo (ordres de raffinage, cargaisons de salvage), remise et ventes
 * (docs/mining-v3/SPEC.md, docs/salvage/SPEC.md).
 * Chaque écriture verrouille la fiche ; les contrôles financiers et de droits sont faits ici, jamais seulement dans l'interface.
 */
@Service
@RequiredArgsConstructor
public class SessionSheetService {
    public static final ZoneId ZONE = ZoneId.of("Europe/Paris");
    static final long MAX_AMOUNT = 1_000_000_000_000L;
    static final int MAX_LINES = 20;
    static final int MAX_QUANTITY_CSCU = 10_000_000;
    static final int MAX_REMAINING_MINUTES = 60 * 24 * 30;
    private static final DateTimeFormatter DEFAULT_NAME = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final SessionSheetRepository sheets;
    private final SessionParticipantRepository participants;
    private final SessionExpenseRepository expenses;
    private final MiningRefineryOrderRepository orders;
    private final SessionSaleRepository sales;
    private final UserRepository users;
    private final SessionLoader loader;
    private final SessionViewBuilder views;
    private final MiningMarketService market;
    private final SessionEvents events;
    private Clock clock = Clock.system(ZONE);

    void setClock(Clock clock) {
        this.clock = clock;
    }

    LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    // ----- Lecture -----

    @Transactional(readOnly = true)
    public List<SessionSummaryDTO> list(String activity) {
        UUID viewer = SessionAccess.currentUserId();
        String wanted = activity == null || activity.isBlank() ? null : activity(activity);
        List<SessionSheet> all = sheets.findAllByOrderBySessionDateDescCreatedAtDesc().stream()
                .filter(sheet -> wanted == null || wanted.equals(sheet.getActivity())).toList();
        Set<UUID> ids = all.stream().map(SessionSheet::getId).collect(Collectors.toSet());
        if (ids.isEmpty()) return List.of();
        Map<UUID, List<SessionParticipant>> people = participants.findBySheetIds(ids).stream().collect(Collectors.groupingBy(SessionParticipant::getSheetId));
        Map<UUID, Long> salesTotal = sales.findBySheetIds(ids).stream().collect(Collectors.groupingBy(SessionSale::getSheetId, Collectors.summingLong(SessionSale::getAmount)));
        Map<UUID, List<MiningRefineryOrder>> sheetOrders = orders.findBySheetIds(ids).stream().collect(Collectors.groupingBy(MiningRefineryOrder::getSheetId));
        Set<UUID> organizerIds = all.stream().map(SessionSheet::getOrganizerUserId).collect(Collectors.toSet());
        Map<UUID, User> organizers = users.findAllById(organizerIds).stream().collect(Collectors.toMap(User::getId, user -> user));
        LocalDateTime now = now();
        return all.stream().map(sheet -> {
            List<SessionParticipant> members = people.getOrDefault(sheet.getId(), List.of());
            SessionData light = new SessionData(sheet, members, List.of(), sheetOrders.getOrDefault(sheet.getId(), List.of()), List.of(), java.util.Optional.empty());
            User organizer = organizers.get(sheet.getOrganizerUserId());
            return new SessionSummaryDTO(sheet.getId(), sheet.getActivity(), sheet.getName(), sheet.getSessionDate(), sheet.getStatus().name(), SessionViewBuilder.phase(light, now),
                    organizer == null ? null : new SessionSheetDTO.UserRef(organizer.getId(), organizer.getUsername(), organizer.getAvatarUrl()),
                    members.size(), salesTotal.getOrDefault(sheet.getId(), 0L), light.isParticipant(viewer), sheet.getOperationEventId());
        }).sorted(Comparator.comparing((SessionSummaryDTO summary) -> "CLOSED".equals(summary.status())).thenComparing(SessionSummaryDTO::sessionDate, Comparator.reverseOrder()))
                .toList();
    }

    @Transactional(readOnly = true)
    public SessionSheetDTO get(UUID sheetId) {
        return view(loader.read(sheetId));
    }

    @Transactional(readOnly = true)
    public SessionSheet findByOperation(UUID operationEventId) {
        return sheets.findByOperationEventId(operationEventId)
                .orElseThrow(() -> new ResourceNotFoundException("Aucune fiche de session pour cette opération."));
    }

    SessionSheetDTO view(SessionData data) {
        UUID viewer = SessionAccess.currentUserId();
        return views.build(data, viewer, SessionAccess.isOrganizer(data.sheet(), viewer), now());
    }

    // ----- Fiche -----

    @Transactional
    public SessionSheetDTO create(SessionRequests.CreateSheet request) {
        SessionAccess.requireCreate();
        UUID actor = SessionAccess.currentUserId();
        LocalDate date = request.sessionDate() != null ? request.sessionDate() : now().toLocalDate();
        List<UUID> people = request.participantIds() == null || request.participantIds().isEmpty() ? List.of(actor) : request.participantIds();
        SessionSheet sheet = newSheet(activity(request.activity()), name(request.name(), date), date, actor, null);
        addParticipants(sheet.getId(), people);
        return view(loader.read(sheet.getId()));
    }

    /**
     * Fiche liée à une opération « Session de minage » ou « Session de salvage » : créée une seule fois, avec tous les membres
     * « Présent », affectés à un groupe ou non. Ensuite la fiche se gère seule. Une fiche existante est renvoyée telle quelle,
     * quelle que soit son activité : une opération n'a jamais deux fiches.
     */
    @Transactional
    public UUID ensureForOperation(UUID operationEventId, String activity, String operationTitle, LocalDate date, UUID organizerId, List<UUID> presentUserIds) {
        return sheets.findByOperationEventId(operationEventId).map(SessionSheet::getId).orElseGet(() -> {
            SessionSheet sheet = newSheet(activity(activity), name(operationTitle, date), date, organizerId, operationEventId);
            addParticipants(sheet.getId(), presentUserIds);
            return sheet.getId();
        });
    }

    @Transactional
    public SessionSheetDTO update(UUID sheetId, SessionRequests.UpdateSheet request) {
        SessionData data = loader.lock(sheetId);
        SessionAccess.requireOrganizer(data.sheet(), SessionAccess.currentUserId());
        SessionSheet sheet = data.sheet();
        if (request.sessionDate() != null) sheet.setSessionDate(request.sessionDate());
        if (request.name() != null) sheet.setName(name(request.name(), sheet.getSessionDate()));
        return saved(sheet);
    }

    /**
     * Supprime la fiche, quel que soit son état. Participants, frais, ordres, ventes, règlements et historique
     * partent avec elle (ON DELETE CASCADE, V45). Les fiches ouvertes se relisent et la trouvent introuvable.
     */
    @Transactional
    public void delete(UUID sheetId) {
        SessionData data = loader.lock(sheetId);
        SessionAccess.requireOrganizer(data.sheet(), SessionAccess.currentUserId());
        sheets.delete(data.sheet());
        events.changed(sheetId);
    }

    @Transactional
    public SessionSheetDTO setParticipants(UUID sheetId, SessionRequests.Participants request) {
        SessionData data = loader.lock(sheetId);
        SessionAccess.requireOrganizer(data.sheet(), SessionAccess.currentUserId());
        SessionAccess.requireActive(data.sheet());
        List<SessionRequests.Participant> wanted = request == null || request.participants() == null ? List.of() : request.participants();
        Map<UUID, Integer> shares = new LinkedHashMap<>();
        for (SessionRequests.Participant participant : wanted) {
            if (participant == null || participant.userId() == null) throw new BadRequestException("Participant invalide.");
            int centi = participant.sharesCenti() == null ? 100 : participant.sharesCenti();
            if (centi < 0 || centi > 10_000) throw new BadRequestException("Une part va de 0 à 100.");
            if (shares.put(participant.userId(), centi) != null) throw new BadRequestException("Un membre figure deux fois dans la liste.");
        }
        if (shares.isEmpty()) throw new BadRequestException("La fiche doit garder au moins un participant.");
        requireUsers(shares.keySet());
        Set<UUID> referenced = referencedUsers(data);
        for (SessionParticipant existing : data.participants()) {
            if (!shares.containsKey(existing.getUserId()) && referenced.contains(existing.getUserId())) {
                throw new BadRequestException("Un participant qui a un frais, un ordre ou une vente ne peut pas être retiré : mettez sa part à 0 ou corrigez d’abord ses saisies.");
            }
        }
        Map<UUID, SessionParticipant> current = data.participants().stream().collect(Collectors.toMap(SessionParticipant::getUserId, p -> p));
        data.participants().stream().filter(p -> !shares.containsKey(p.getUserId())).forEach(participants::delete);
        LocalDateTime now = now();
        int index = 0;
        for (Map.Entry<UUID, Integer> entry : shares.entrySet()) {
            SessionParticipant participant = current.get(entry.getKey());
            if (participant == null) {
                // Un nanoseconde d'écart par rang : l'ordre d'arrivée reste celui de la liste envoyée.
                participant = SessionParticipant.builder().sheetId(sheetId).userId(entry.getKey()).joinedAt(now.plusNanos(index * 1000L)).build();
            }
            participant.setSharesCenti(entry.getValue());
            participants.save(participant);
            index++;
        }
        return saved(data.sheet());
    }

    // ----- Frais -----

    @Transactional
    public SessionSheetDTO addExpense(UUID sheetId, SessionRequests.Expense request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionExpense expense = SessionExpense.builder().sheetId(sheetId).createdAt(now()).build();
        applyExpense(data, expense, request, actor);
        expenses.save(expense);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO updateExpense(UUID sheetId, UUID expenseId, SessionRequests.Expense request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionExpense expense = data.expenses().stream().filter(e -> e.getId().equals(expenseId)).findFirst().orElseThrow(() -> notFound("Frais"));
        requireOwnerOrOrganizer(data, actor, expense.getPayerUserId(), "Vous ne modifiez que vos propres frais.");
        applyExpense(data, expense, request, actor);
        expenses.save(expense);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO deleteExpense(UUID sheetId, UUID expenseId) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionExpense expense = data.expenses().stream().filter(e -> e.getId().equals(expenseId)).findFirst().orElseThrow(() -> notFound("Frais"));
        requireOwnerOrOrganizer(data, actor, expense.getPayerUserId(), "Vous ne supprimez que vos propres frais.");
        expenses.delete(expense);
        return saved(data.sheet());
    }

    private void applyExpense(SessionData data, SessionExpense expense, SessionRequests.Expense request, UUID actor) {
        if (request == null) throw new BadRequestException("Frais invalide.");
        UUID payer = chosenUser(data, actor, request.payerUserId(), "Seul l’organisateur déclare un frais au nom d’un autre participant.");
        requireParticipant(data, payer, "Le payeur doit être un participant de la fiche.");
        expense.setPayerUserId(payer);
        expense.setKind(parseEnum(SessionExpense.Kind.class, request.kind(), "Type de frais invalide."));
        expense.setAmount(amount(request.amount(), false));
        expense.setNote(text(request.note(), 200));
    }

    // ----- Ordres de raffinage -----

    @Transactional
    public SessionSheetDTO addOrder(UUID sheetId, SessionRequests.RefineryOrder request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        if (request == null) throw new BadRequestException("Lot de cargo invalide.");
        MiningRefineryOrder.Kind kind = kind(data, request.kind());
        if (kind == MiningRefineryOrder.Kind.REFINERY && request.remainingMinutes() == null) throw new BadRequestException("Indiquez la durée restante affichée par la raffinerie.");
        MiningRefineryOrder order = MiningRefineryOrder.builder().sheetId(sheetId).kind(kind).createdAt(now()).build();
        applyOrder(data, order, request, actor);
        // Une cargaison gardée par son détenteur pour la vendre lui-même est déjà dans sa soute : elle est remise d'office.
        if (order.isHaul() && order.getLauncherUserId().equals(order.getRecipientUserId())) order.setHandedOverAt(now());
        orders.save(order);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO updateOrder(UUID sheetId, UUID orderId, SessionRequests.RefineryOrder request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        MiningRefineryOrder order = order(data, orderId);
        requireOwnerOrOrganizer(data, actor, order.getLauncherUserId(), "Vous ne modifiez que vos propres ordres.");
        applyOrder(data, order, request, actor);
        requireStocksNotNegative(data, "Cette modification retirerait " + goodsLower(data) + " déjà vendu : corrigez d’abord la vente concernée.");
        orders.save(order);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO deleteOrder(UUID sheetId, UUID orderId) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        MiningRefineryOrder order = order(data, orderId);
        requireOwnerOrOrganizer(data, actor, order.getLauncherUserId(), "Vous ne supprimez que vos propres ordres.");
        data.orders().remove(order);
        requireStocksNotNegative(data, "Ce " + goodsWord(data) + " a déjà été vendu : supprimez d’abord la vente concernée.");
        orders.delete(order);
        return saved(data.sheet());
    }

    /** « Remis » : seule action de remise ; « Je l'ai récupéré » quand le lanceur est le destinataire. Rien n'est automatique. */
    @Transactional
    public SessionSheetDTO handOver(UUID sheetId, UUID orderId, boolean handedOver) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        MiningRefineryOrder order = order(data, orderId);
        boolean allowed = SessionAccess.isOrganizer(data.sheet(), actor) || actor.equals(order.getLauncherUserId()) || actor.equals(order.getRecipientUserId());
        if (!allowed) throw new ForbiddenException("Seuls le lanceur, le vendeur destinataire et l’organisateur indiquent la remise.");
        if (handedOver) {
            if (order.isHandedOver()) throw new BadRequestException("Cet ordre est déjà indiqué comme remis.");
            order.setHandedOverAt(now());
        } else {
            if (!order.isHandedOver()) throw new BadRequestException("Cet ordre n’est pas indiqué comme remis.");
            LocalDateTime previous = order.getHandedOverAt();
            order.setHandedOverAt(null);
            try {
                requireStocksNotNegative(data, "Ce " + goodsWord(data) + " a déjà été vendu : la remise ne peut plus être annulée.");
            } catch (BadRequestException refused) {
                order.setHandedOverAt(previous);
                throw refused;
            }
        }
        orders.save(order);
        return saved(data.sheet());
    }

    /**
     * Ordre de raffinage : raffinerie UEX, méthode, durée restante, qualité obligatoire pour le minerai.
     * Cargaison de salvage : lieu libre (vaisseau, station), ni raffinerie ni durée, prête dès sa saisie, sans qualité.
     * Le type d'un lot ne change pas après sa création.
     */
    private void applyOrder(SessionData data, MiningRefineryOrder order, SessionRequests.RefineryOrder request, UUID actor) {
        if (request == null) throw new BadRequestException("Lot de cargo invalide.");
        boolean haul = order.isHaul();
        boolean salvage = data.sheet().isSalvage();
        UUID launcher = chosenUser(data, actor, request.launcherUserId(), haul
                ? "Seul l’organisateur déclare une cargaison au nom d’un autre participant."
                : "Seul l’organisateur crée un ordre au nom d’un autre participant.");
        if (order.getLauncherUserId() != null && !SessionAccess.isOrganizer(data.sheet(), actor)) launcher = order.getLauncherUserId();
        requireParticipant(data, launcher, haul ? "Le détenteur de la cargaison doit être un participant de la fiche." : "Le lanceur doit être un participant de la fiche.");
        UUID recipient = request.recipientUserId() != null ? request.recipientUserId() : launcher;
        requireParticipant(data, recipient, "Le vendeur destinataire doit être un participant de la fiche.");
        if (haul) {
            String location = text(request.locationLabel(), 200);
            if (location == null) throw new BadRequestException("Indiquez où se trouve la cargaison (vaisseau ou station).");
            List<MiningRefineryOrderLine> parsed = parseLines(data, order, request.lines(), salvage);
            if (order.getFinishesAt() == null) {
                // Prête dès sa saisie : jamais annoncée comme un raffinage sur Discord.
                order.setFinishesAt(now());
                order.setReadyNotifiedAt(now());
            }
            order.setLauncherUserId(launcher);
            order.setRecipientUserId(recipient);
            order.setTerminalId(null);
            order.setTerminalLabel(location);
            order.setMethodCode(null);
            order.setMethodLabel(null);
            order.setCost(amount(request.cost() == null ? 0L : request.cost(), true));
            order.getLines().clear();
            order.getLines().addAll(parsed);
            return;
        }
        if (request.terminalId() == null) throw new BadRequestException("Choisissez la raffinerie.");
        MiningMarketService.Terminal terminal = market.terminals().get(request.terminalId());
        if (terminal == null) throw new BadRequestException("Raffinerie inconnue dans les données UEX.");
        String methodLabel = null;
        if (request.methodCode() != null && !request.methodCode().isBlank()) {
            methodLabel = market.methods().stream().filter(m -> m.code().equalsIgnoreCase(request.methodCode().trim())).findFirst()
                    .map(MiningMarketService.Method::name).orElseThrow(() -> new BadRequestException("Méthode de raffinage inconnue."));
        }
        if (request.remainingMinutes() != null) {
            int minutes = request.remainingMinutes();
            if (minutes < 0 || minutes > MAX_REMAINING_MINUTES) throw new BadRequestException("Durée restante invalide.");
            LocalDateTime finishes = now().plusMinutes(minutes);
            if (!finishes.equals(order.getFinishesAt())) order.setReadyNotifiedAt(null);
            order.setFinishesAt(finishes);
        }
        List<MiningRefineryOrderLine> parsed = parseLines(data, order, request.lines(), salvage);
        order.setLauncherUserId(launcher);
        order.setRecipientUserId(recipient);
        order.setTerminalId(terminal.id());
        order.setTerminalLabel(terminal.name());
        order.setMethodCode(methodLabel == null ? null : request.methodCode().trim().toUpperCase());
        order.setMethodLabel(methodLabel);
        order.setCost(amount(request.cost() == null ? 0L : request.cost(), true));
        order.getLines().clear();
        order.getLines().addAll(parsed);
    }

    /**
     * Lignes d'un lot : minerais raffinés (qualité obligatoire) pour le minage, matériaux de salvage (RMC, construction)
     * pour le salvage, où la qualité n'existe pas : une qualité envoyée est ignorée plutôt que stockée.
     */
    private List<MiningRefineryOrderLine> parseLines(SessionData data, MiningRefineryOrder order, List<SessionRequests.OrderLine> requested, boolean salvage) {
        List<SessionRequests.OrderLine> lines = requested == null ? List.of() : requested;
        String word = goodsWord(data);
        if (lines.isEmpty() || lines.size() > MAX_LINES) throw new BadRequestException("Un lot contient de 1 à " + MAX_LINES + " " + goodsPlural(data) + ".");
        Map<Integer, MiningMarketService.Commodity> commodities = market.commoditiesFor(data.sheet().getActivity());
        List<MiningRefineryOrderLine> parsed = new ArrayList<>();
        int position = 0;
        for (SessionRequests.OrderLine line : lines) {
            if (line == null || line.commodityId() == null) throw new BadRequestException("Choisissez le " + word + " de chaque ligne.");
            MiningMarketService.Commodity commodity = commodities.get(line.commodityId());
            if (commodity == null) throw new BadRequestException(salvage ? "Matériau de salvage inconnu dans les données UEX." : "Minerai raffiné inconnu dans les données UEX.");
            int quantity = quantity(line.quantityCscu());
            Integer quality = null;
            if (!salvage) {
                if (line.quality() == null || line.quality() < 0 || line.quality() > 1000) throw new BadRequestException("La qualité est obligatoire, de 0 à 1000.");
                quality = line.quality();
            }
            parsed.add(MiningRefineryOrderLine.builder().order(order).commodityId(commodity.id()).commodityName(commodity.name())
                    .quantityCscu(quantity).quality(quality)
                    .destination(parseEnum(MiningRefineryOrderLine.Destination.class, line.destination() == null ? "SELL" : line.destination(), "Destination invalide."))
                    .position(position++).build());
        }
        return parsed;
    }

    /** Une cargaison (HAUL) n'existe que sur une fiche de salvage. */
    private static MiningRefineryOrder.Kind kind(SessionData data, String requested) {
        MiningRefineryOrder.Kind kind = requested == null || requested.isBlank() ? MiningRefineryOrder.Kind.REFINERY
                : parseEnum(MiningRefineryOrder.Kind.class, requested, "Type de lot invalide.");
        if (kind == MiningRefineryOrder.Kind.HAUL && !data.sheet().isSalvage()) throw new BadRequestException("Une cargaison récupérée ne se déclare que sur une fiche de salvage.");
        return kind;
    }

    // ----- Ventes -----

    @Transactional
    public SessionSheetDTO addSale(UUID sheetId, SessionRequests.Sale request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionSale sale = SessionSale.builder().sheetId(sheetId).soldAt(now()).build();
        applySale(data, sale, request, actor, data.sales());
        sales.save(sale);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO updateSale(UUID sheetId, UUID saleId, SessionRequests.Sale request) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionSale sale = sale(data, saleId);
        requireOwnerOrOrganizer(data, actor, sale.getSellerUserId(), "Vous ne modifiez que vos propres ventes.");
        List<SessionSale> others = data.sales().stream().filter(s -> !s.getId().equals(saleId)).toList();
        applySale(data, sale, request, actor, others);
        sales.save(sale);
        return saved(data.sheet());
    }

    @Transactional
    public SessionSheetDTO deleteSale(UUID sheetId, UUID saleId) {
        SessionData data = loader.lock(sheetId);
        UUID actor = editor(data);
        SessionSale sale = sale(data, saleId);
        requireOwnerOrOrganizer(data, actor, sale.getSellerUserId(), "Vous ne supprimez que vos propres ventes.");
        sales.delete(sale);
        return saved(data.sheet());
    }

    /** Le stock est contrôlé sur les autres ventes du vendeur, les lignes d'un même minerai étant cumulées. */
    private void applySale(SessionData data, SessionSale sale, SessionRequests.Sale request, UUID actor, List<SessionSale> otherSales) {
        if (request == null) throw new BadRequestException("Vente invalide.");
        UUID seller = chosenUser(data, actor, request.sellerUserId(), "Seul l’organisateur enregistre une vente au nom d’un autre participant.");
        if (sale.getSellerUserId() != null && !SessionAccess.isOrganizer(data.sheet(), actor)) seller = sale.getSellerUserId();
        requireParticipant(data, seller, "Le vendeur doit être un participant de la fiche.");
        String label;
        Integer terminalId = request.terminalId();
        if (terminalId != null) {
            MiningMarketService.Terminal terminal = market.terminals().get(terminalId);
            if (terminal == null) throw new BadRequestException("Terminal de vente inconnu dans les données UEX.");
            label = terminal.name();
        } else {
            label = text(request.terminalLabel(), 200);
            if (label == null) throw new BadRequestException("Indiquez le lieu de vente.");
        }
        List<SessionRequests.SaleLine> lines = request.lines() == null ? List.of() : request.lines();
        // Salvage : une vente sans ligne est une vente directe (composants démontés, récompense de contrat), hors stock.
        boolean direct = lines.isEmpty() && data.sheet().isSalvage();
        if ((lines.isEmpty() && !direct) || lines.size() > MAX_LINES) throw new BadRequestException("Une vente contient de 1 à " + MAX_LINES + " " + goodsPlural(data) + ".");
        Map<Integer, String> names = new HashMap<>();
        data.orders().forEach(o -> o.getLines().forEach(l -> names.putIfAbsent(l.getCommodityId(), l.getCommodityName())));
        List<MiningStock.Line> wanted = new ArrayList<>();
        for (SessionRequests.SaleLine line : lines) {
            if (line == null || line.commodityId() == null) throw new BadRequestException("Choisissez le " + goodsWord(data) + " de chaque ligne.");
            wanted.add(new MiningStock.Line(line.commodityId(), quantity(line.quantityCscu())));
        }
        Map<Integer, Long> stock = MiningStock.stockOf(seller, data.orders(), otherSales);
        List<MiningStock.Shortage> shortages = MiningStock.shortages(wanted, stock);
        if (!shortages.isEmpty()) {
            String detail = shortages.stream().map(s -> names.getOrDefault(s.commodityId(), SessionViewBuilder.goods(data) + " " + s.commodityId()) + " : "
                    + MiningNotifications.scu((int) Math.min(Integer.MAX_VALUE, s.wanted())) + " SCU demandés, "
                    + MiningNotifications.scu((int) s.available()) + " disponibles").collect(Collectors.joining(" ; "));
            throw new BadRequestException("Stock insuffisant chez le vendeur. " + detail + ". Seul " + (data.sheet().isSalvage() ? "le matériau" : "le minerai") + " remis au vendeur peut être vendu.");
        }
        sale.setSellerUserId(seller);
        sale.setTerminalId(terminalId);
        sale.setTerminalLabel(label);
        sale.setAmount(amount(request.amount(), false));
        sale.getLines().clear();
        int position = 0;
        for (MiningStock.Line line : wanted) {
            sale.getLines().add(MiningSaleLine.builder().sale(sale).commodityId(line.commodityId())
                    .commodityName(names.getOrDefault(line.commodityId(), SessionViewBuilder.goods(data) + " " + line.commodityId()))
                    .quantityCscu(line.quantityCscu()).position(position++).build());
        }
    }

    // ----- Outils -----

    private SessionSheet newSheet(String activity, String name, LocalDate date, UUID organizer, UUID operationEventId) {
        LocalDateTime now = now();
        SessionSheet sheet = sheets.save(SessionSheet.builder().activity(activity).name(name).sessionDate(date).organizerUserId(organizer)
                .operationEventId(operationEventId).createdAt(now).updatedAt(now).build());
        events.changed(sheet.getId());
        return sheet;
    }

    private void addParticipants(UUID sheetId, List<UUID> userIds) {
        LinkedHashSet<UUID> unique = new LinkedHashSet<>(userIds);
        unique.remove(null);
        requireUsers(unique);
        LocalDateTime now = now();
        int index = 0;
        for (UUID userId : unique) {
            participants.save(SessionParticipant.builder().sheetId(sheetId).userId(userId).sharesCenti(100).joinedAt(now.plusNanos(index * 1000L)).build());
            index++;
        }
    }

    private void requireUsers(Set<UUID> ids) {
        Set<UUID> found = users.findAllById(ids).stream().filter(user -> !Boolean.FALSE.equals(user.getActive())).map(User::getId).collect(Collectors.toSet());
        if (!found.containsAll(ids)) throw new BadRequestException("Un membre est introuvable ou désactivé.");
    }

    private SessionSheetDTO saved(SessionSheet sheet) {
        sheet.touch(now());
        sheets.save(sheet);
        events.changed(sheet.getId());
        return view(loader.read(sheet.getId()));
    }

    /** Écrire dans une fiche : fiche en cours, et être participant ou organisateur. */
    private UUID editor(SessionData data) {
        UUID actor = SessionAccess.currentUserId();
        SessionAccess.requireActive(data.sheet());
        if (!data.isParticipant(actor) && !SessionAccess.isOrganizer(data.sheet(), actor)) {
            throw new ForbiddenException("Seuls les participants de la fiche y font des saisies.");
        }
        return actor;
    }

    private static UUID chosenUser(SessionData data, UUID actor, UUID requested, String forbidden) {
        if (requested == null || requested.equals(actor)) return actor;
        if (!SessionAccess.isOrganizer(data.sheet(), actor)) throw new ForbiddenException(forbidden);
        return requested;
    }

    private static void requireOwnerOrOrganizer(SessionData data, UUID actor, UUID owner, String message) {
        if (!actor.equals(owner) && !SessionAccess.isOrganizer(data.sheet(), actor)) throw new ForbiddenException(message);
    }

    private static void requireParticipant(SessionData data, UUID userId, String message) {
        if (!data.isParticipant(userId)) throw new BadRequestException(message);
    }

    /** Après une modification d'ordre ou de remise : aucun vendeur ne peut avoir vendu plus que ce qu'il a reçu. */
    private static void requireStocksNotNegative(SessionData data, String message) {
        Set<UUID> sellers = new HashSet<>();
        data.sales().forEach(sale -> sellers.add(sale.getSellerUserId()));
        for (UUID seller : sellers) {
            if (MiningStock.anyNegative(MiningStock.stockOf(seller, data.orders(), data.sales()))) throw new BadRequestException(message);
        }
    }

    private static Set<UUID> referencedUsers(SessionData data) {
        Set<UUID> ids = new HashSet<>();
        data.expenses().forEach(e -> ids.add(e.getPayerUserId()));
        data.orders().forEach(o -> { ids.add(o.getLauncherUserId()); ids.add(o.getRecipientUserId()); });
        data.sales().forEach(s -> ids.add(s.getSellerUserId()));
        return ids;
    }

    private static MiningRefineryOrder order(SessionData data, UUID orderId) {
        return data.orders().stream().filter(o -> o.getId().equals(orderId)).findFirst().orElseThrow(() -> notFound("Ordre de raffinage"));
    }

    private static SessionSale sale(SessionData data, UUID saleId) {
        return data.sales().stream().filter(s -> s.getId().equals(saleId)).findFirst().orElseThrow(() -> notFound("Vente"));
    }

    private static ResourceNotFoundException notFound(String what) {
        return new ResourceNotFoundException(what + " introuvable sur cette fiche.");
    }

    static long amount(Long value, boolean zeroAllowed) {
        if (value == null) throw new BadRequestException("Indiquez un montant en aUEC.");
        if (value < 0 || (!zeroAllowed && value == 0) || value > MAX_AMOUNT) {
            throw new BadRequestException(zeroAllowed ? "Montant invalide." : "Le montant doit être supérieur à zéro.");
        }
        return value;
    }

    static int quantity(Integer cscu) {
        if (cscu == null || cscu <= 0 || cscu > MAX_QUANTITY_CSCU) throw new BadRequestException("Quantité invalide : indiquez une quantité positive.");
        return cscu;
    }

    static String text(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > max) throw new BadRequestException("Texte trop long (" + max + " caractères au plus).");
        return trimmed;
    }

    /** Activité d'une fiche : MINING par défaut, ou SALVAGE. */
    static String activity(String requested) {
        if (requested == null || requested.isBlank()) return SessionSheet.MINING;
        String value = requested.trim().toUpperCase();
        if (!SessionSheet.MINING.equals(value) && !SessionSheet.SALVAGE.equals(value)) throw new BadRequestException("Activité de fiche invalide.");
        return value;
    }

    /** « minerai » ou « matériau », pour les messages. */
    static String goodsWord(SessionData data) {
        return data.sheet().isSalvage() ? "matériau" : "minerai";
    }

    static String goodsPlural(SessionData data) {
        return data.sheet().isSalvage() ? "matériaux" : "minerais";
    }

    static String goodsLower(SessionData data) {
        return data.sheet().isSalvage() ? "du matériau" : "du minerai";
    }

    private static String name(String requested, LocalDate date) {
        String value = text(requested, 160);
        return value != null ? value : "Session du " + DEFAULT_NAME.format(date);
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String message) {
        if (value == null) throw new BadRequestException(message);
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException(message);
        }
    }
}
