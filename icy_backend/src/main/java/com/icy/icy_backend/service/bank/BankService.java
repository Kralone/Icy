package com.icy.icy_backend.service.bank;

import com.icy.icy_backend.controller.dto.bank.BankDtos;
import com.icy.icy_backend.db.entity.bank.BankEntry;
import com.icy.icy_backend.db.entity.bank.BankProject;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.bank.BankEntryRepository;
import com.icy.icy_backend.db.repository.bank.BankProjectRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Banque de guilde : l'argent reste en jeu chez le trésorier, l'application en tient le registre.
 * Le solde se calcule toujours à partir du journal ; une ligne annulée ne compte plus mais reste visible.
 */
@Service
@RequiredArgsConstructor
public class BankService {
    static final long MAX_AMOUNT = 1_000_000_000_000L;
    static final int MONTHS = 12;
    static final int RECENT = 8;

    private final BankEntryRepository entries;
    private final BankProjectRepository projects;
    private final UserRepository users;
    private final ShipRepository ships;
    private final BankAccess access;
    private final BankEvents events;
    @Setter
    private Clock clock = Clock.systemDefaultZone();

    // ----- Lecture -----

    @Transactional(readOnly = true)
    public BankDtos.Overview overview() {
        Set<String> roles = access.currentRoles();
        UUID me = access.currentUserId();
        List<BankEntry> all = entries.findAllByOrderByOccurredOnDescRecordedAtDesc();
        List<BankEntry> live = all.stream().filter(entry -> !entry.isCancelled()).toList();
        Map<UUID, BankProject> projectById = projectsById();
        Names names = names(all);

        List<BankDtos.PublicEntry> recent = live.stream().limit(RECENT)
                .map(entry -> new BankDtos.PublicEntry(entry.getId(), entry.getKind().name(), entry.getAmount(), entry.getProjectId(),
                        projectName(projectById, entry.getProjectId()), entry.getOccurredOn()))
                .toList();
        List<BankEntry> mineEntries = all.stream().filter(entry -> me.equals(entry.getUserId())).toList();
        BankDtos.Mine mine = new BankDtos.Mine(
                sum(mineEntries, BankEntry.Kind.DEPOSIT), sum(mineEntries, BankEntry.Kind.PAYOUT),
                mineEntries.stream().map(entry -> entry(entry, projectById, names)).toList());

        return new BankDtos.Overview(
                new BankDtos.Access(access.canViewDetails(roles), access.canWrite(roles)),
                totals(live), months(live), balanceCurve(live), projectViews(projectById.values(), live), recent, mine);
    }

    @Transactional(readOnly = true)
    public BankDtos.Details details() {
        access.requireDetails();
        List<BankEntry> all = entries.findAllByOrderByOccurredOnDescRecordedAtDesc();
        Map<UUID, BankProject> projectById = projectsById();
        Names names = names(all);
        List<BankDtos.Entry> views = all.stream().map(entry -> entry(entry, projectById, names)).toList();
        return new BankDtos.Details(views, players(all, names));
    }

    /** Membres actifs pour la saisie : la liste complète des comptes reste réservée à l'administration. */
    @Transactional(readOnly = true)
    public List<BankDtos.Member> members() {
        access.requireWrite();
        return users.findAll().stream()
                .map(user -> new BankDtos.Member(user.getId(), user.getUsername()))
                .sorted(Comparator.comparing(BankDtos.Member::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    // ----- Écriture -----

    @Transactional
    public BankDtos.Entry record(BankDtos.EntryRequest request) {
        access.requireWrite();
        if (request == null) throw new BadRequestException("Mouvement vide.");
        BankEntry.Kind kind = parse(BankEntry.Kind.class, request.kind(), "Type de mouvement inconnu.");
        long amount = amount(kind, request.amount());
        String note = clean(request.note(), 300);
        LocalDate today = LocalDate.now(clock);
        LocalDate occurredOn = request.occurredOn() == null ? today : request.occurredOn();
        if (occurredOn.isAfter(today.plusDays(1))) throw new BadRequestException("La date du mouvement ne peut pas être dans le futur.");

        if ((kind == BankEntry.Kind.DEPOSIT || kind == BankEntry.Kind.PAYOUT) && request.userId() == null) {
            throw new BadRequestException(kind == BankEntry.Kind.DEPOSIT ? "Indiquez le joueur qui donne." : "Indiquez le joueur qui reçoit.");
        }
        if (request.userId() != null && users.findById(request.userId()).isEmpty()) {
            throw new BadRequestException("Ce joueur n'est pas un membre actif.");
        }
        BankProject project = null;
        if (request.projectId() != null) {
            project = projects.findById(request.projectId()).orElseThrow(() -> new BadRequestException("Projet introuvable."));
            if (project.getStatus() == BankProject.Status.CANCELLED) throw new BadRequestException("Ce projet est annulé.");
        }
        if (kind == BankEntry.Kind.EXPENSE && project == null && note == null) {
            throw new BadRequestException("Indiquez le projet ou ce qui a été acheté.");
        }
        if (kind == BankEntry.Kind.ADJUSTMENT && note == null) {
            throw new BadRequestException("Expliquez la raison de l'ajustement.");
        }

        BankEntry saved = entries.save(BankEntry.builder()
                .kind(kind).amount(amount).userId(request.userId()).projectId(project == null ? null : project.getId())
                .note(note).occurredOn(occurredOn).recordedBy(access.currentUserId()).recordedAt(LocalDateTime.now(clock))
                .build());
        events.changed();
        return entry(saved, projectsById(), names(List.of(saved)));
    }

    @Transactional
    public BankDtos.Entry cancel(UUID entryId, BankDtos.CancelRequest request) {
        access.requireWrite();
        String reason = clean(request == null ? null : request.reason(), 300);
        if (reason == null) throw new BadRequestException("Indiquez le motif de l'annulation.");
        BankEntry entry = entries.findById(entryId).orElseThrow(() -> new ResourceNotFoundException("Mouvement introuvable."));
        if (entry.isCancelled()) throw new BadRequestException("Ce mouvement est déjà annulé.");
        entry.setCancelledAt(LocalDateTime.now(clock));
        entry.setCancelledBy(access.currentUserId());
        entry.setCancelReason(reason);
        BankEntry saved = entries.save(entry);
        events.changed();
        return entry(saved, projectsById(), names(List.of(saved)));
    }

    @Transactional
    public BankDtos.Project createProject(BankDtos.ProjectRequest request) {
        access.requireWrite();
        if (request == null) throw new BadRequestException("Projet vide.");
        LocalDateTime now = LocalDateTime.now(clock);
        BankProject project = BankProject.builder().createdBy(access.currentUserId()).createdAt(now).updatedAt(now).build();
        apply(project, request, false);
        BankProject saved = projects.save(project);
        events.changed();
        return projectView(saved, List.of());
    }

    @Transactional
    public BankDtos.Project updateProject(UUID projectId, BankDtos.ProjectRequest request) {
        access.requireWrite();
        if (request == null) throw new BadRequestException("Projet vide.");
        BankProject project = projects.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Projet introuvable."));
        apply(project, request, true);
        project.setUpdatedAt(LocalDateTime.now(clock));
        BankProject saved = projects.save(project);
        events.changed();
        List<BankEntry> live = entries.findAllByOrderByOccurredOnDescRecordedAtDesc().stream().filter(entry -> !entry.isCancelled()).toList();
        return projectView(saved, live);
    }

    private void apply(BankProject project, BankDtos.ProjectRequest request, boolean withStatus) {
        String name = clean(request.name(), 120);
        if (name == null) throw new BadRequestException("Donnez un nom au projet.");
        Long target = request.targetAmount();
        if (target != null && (target <= 0 || target > MAX_AMOUNT)) throw new BadRequestException("L'objectif doit être un montant positif.");
        if (request.shipId() != null && ships.findById(request.shipId()).isEmpty()) throw new BadRequestException("Vaisseau introuvable dans le catalogue.");
        project.setName(name);
        project.setDescription(clean(request.description(), 500));
        project.setTargetAmount(target);
        project.setShipId(request.shipId());
        if (withStatus && request.status() != null && !request.status().isBlank()) {
            project.setStatus(parse(BankProject.Status.class, request.status(), "Statut de projet inconnu."));
        }
    }

    // ----- Calculs -----

    static BankDtos.Totals totals(List<BankEntry> live) {
        int donors = (int) live.stream().filter(entry -> entry.getKind() == BankEntry.Kind.DEPOSIT).map(BankEntry::getUserId).distinct().count();
        return new BankDtos.Totals(
                live.stream().mapToLong(BankEntry::signedAmount).sum(),
                sum(live, BankEntry.Kind.DEPOSIT), sum(live, BankEntry.Kind.EXPENSE), sum(live, BankEntry.Kind.PAYOUT),
                sum(live, BankEntry.Kind.ADJUSTMENT), donors, live.size());
    }

    /** Les douze derniers mois, mois vides compris, avec le solde à la fin de chaque mois. */
    List<BankDtos.MonthPoint> months(List<BankEntry> live) {
        YearMonth current = YearMonth.now(clock);
        YearMonth first = current.minusMonths(MONTHS - 1L);
        Map<YearMonth, List<BankEntry>> byMonth = live.stream().collect(Collectors.groupingBy(entry -> YearMonth.from(entry.getOccurredOn())));
        long balance = live.stream().filter(entry -> YearMonth.from(entry.getOccurredOn()).isBefore(first)).mapToLong(BankEntry::signedAmount).sum();
        List<BankDtos.MonthPoint> points = new ArrayList<>();
        for (YearMonth month = first; !month.isAfter(current); month = month.plusMonths(1)) {
            List<BankEntry> of = byMonth.getOrDefault(month, List.of());
            balance += of.stream().mapToLong(BankEntry::signedAmount).sum();
            points.add(new BankDtos.MonthPoint(month.toString(), sum(of, BankEntry.Kind.DEPOSIT), sum(of, BankEntry.Kind.EXPENSE),
                    sum(of, BankEntry.Kind.PAYOUT), adjustments(of, true), adjustments(of, false), balance));
        }
        return points;
    }

    /** Un point par jour qui a connu un mouvement, du plus ancien au plus récent. */
    static List<BankDtos.BalancePoint> balanceCurve(List<BankEntry> live) {
        TreeMap<LocalDate, Long> byDay = live.stream().collect(Collectors.groupingBy(BankEntry::getOccurredOn, TreeMap::new,
                Collectors.summingLong(BankEntry::signedAmount)));
        List<BankDtos.BalancePoint> points = new ArrayList<>();
        long balance = 0;
        for (Map.Entry<LocalDate, Long> day : byDay.entrySet()) {
            balance += day.getValue();
            points.add(new BankDtos.BalancePoint(day.getKey(), balance));
        }
        return points;
    }

    private List<BankDtos.Project> projectViews(Collection<BankProject> all, List<BankEntry> live) {
        Map<Long, Ship> shipById = shipsById(all);
        Comparator<BankProject> order = Comparator.<BankProject>comparingInt(project -> project.getStatus().ordinal())
                .thenComparing(BankProject::getCreatedAt, Comparator.reverseOrder());
        return all.stream().sorted(order).map(project -> projectView(project, live, project.getShipId() == null ? null : shipById.get(project.getShipId()))).toList();
    }

    private BankDtos.Project projectView(BankProject project, List<BankEntry> live) {
        Ship ship = project.getShipId() == null ? null : ships.findById(project.getShipId()).orElse(null);
        return projectView(project, live, ship);
    }

    static BankDtos.Project projectView(BankProject project, List<BankEntry> live, Ship ship) {
        List<BankEntry> of = live.stream().filter(entry -> project.getId().equals(entry.getProjectId())).toList();
        long collected = sum(of, BankEntry.Kind.DEPOSIT);
        long spent = sum(of, BankEntry.Kind.EXPENSE);
        long paidOut = sum(of, BankEntry.Kind.PAYOUT);
        long adjustments = sum(of, BankEntry.Kind.ADJUSTMENT);
        int contributors = (int) of.stream().filter(entry -> entry.getKind() == BankEntry.Kind.DEPOSIT).map(BankEntry::getUserId).distinct().count();
        return new BankDtos.Project(project.getId(), project.getName(), project.getDescription(), project.getTargetAmount(), project.getStatus().name(),
                project.getShipId(), ship == null ? null : ship.getName(), ship == null ? null : ship.getImageUrl(),
                collected, spent, paidOut, collected - spent - paidOut + adjustments, contributors, project.getCreatedAt());
    }

    private static List<BankDtos.Player> players(List<BankEntry> all, Names names) {
        Map<UUID, List<BankEntry>> byPlayer = all.stream().filter(entry -> !entry.isCancelled() && entry.getUserId() != null)
                .collect(Collectors.groupingBy(BankEntry::getUserId));
        return byPlayer.entrySet().stream().map(item -> {
                    List<BankEntry> of = item.getValue();
                    List<BankEntry> deposits = of.stream().filter(entry -> entry.getKind() == BankEntry.Kind.DEPOSIT).toList();
                    LocalDate last = deposits.stream().map(BankEntry::getOccurredOn).max(Comparator.naturalOrder()).orElse(null);
                    User user = names.users().get(item.getKey());
                    return new BankDtos.Player(item.getKey(), names.name(item.getKey()), user == null ? null : user.getAvatarUrl(),
                            sum(of, BankEntry.Kind.DEPOSIT), sum(of, BankEntry.Kind.PAYOUT), deposits.size(), last);
                })
                .sorted(Comparator.comparingLong(BankDtos.Player::given).reversed().thenComparing(BankDtos.Player::userName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static BankDtos.Entry entry(BankEntry entry, Map<UUID, BankProject> projectById, Names names) {
        User user = entry.getUserId() == null ? null : names.users().get(entry.getUserId());
        return new BankDtos.Entry(entry.getId(), entry.getKind().name(), entry.getAmount(), entry.signedAmount(),
                entry.getUserId(), entry.getUserId() == null ? null : names.name(entry.getUserId()), user == null ? null : user.getAvatarUrl(),
                entry.getProjectId(), projectName(projectById, entry.getProjectId()), entry.getNote(), entry.getOccurredOn(),
                entry.getRecordedBy(), names.name(entry.getRecordedBy()), entry.getRecordedAt(),
                entry.isCancelled(), entry.getCancelledAt(), entry.getCancelledBy() == null ? null : names.name(entry.getCancelledBy()), entry.getCancelReason());
    }

    /** Ajustements d'un seul sens, en valeur positive : une hausse et une baisse le même mois ne s'annulent pas. */
    static long adjustments(List<BankEntry> list, boolean increase) {
        return list.stream().filter(entry -> entry.getKind() == BankEntry.Kind.ADJUSTMENT && !entry.isCancelled())
                .mapToLong(BankEntry::getAmount).filter(amount -> increase ? amount > 0 : amount < 0).map(Math::abs).sum();
    }

    static long sum(List<BankEntry> list, BankEntry.Kind kind) {
        return list.stream().filter(entry -> entry.getKind() == kind && !entry.isCancelled()).mapToLong(BankEntry::getAmount).sum();
    }

    private static String projectName(Map<UUID, BankProject> projectById, UUID projectId) {
        BankProject project = projectId == null ? null : projectById.get(projectId);
        return project == null ? null : project.getName();
    }

    private Map<UUID, BankProject> projectsById() {
        return projects.findAllByOrderByCreatedAtDesc().stream().collect(Collectors.toMap(BankProject::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    private Map<Long, Ship> shipsById(Collection<BankProject> all) {
        Set<Long> ids = all.stream().map(BankProject::getShipId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return ships.findAllById(ids).stream().collect(Collectors.toMap(Ship::getId, Function.identity(), (a, b) -> a));
    }

    private Names names(List<BankEntry> list) {
        Set<UUID> ids = new HashSet<>();
        for (BankEntry entry : list) {
            if (entry.getUserId() != null) ids.add(entry.getUserId());
            if (entry.getRecordedBy() != null) ids.add(entry.getRecordedBy());
            if (entry.getCancelledBy() != null) ids.add(entry.getCancelledBy());
        }
        if (ids.isEmpty()) return new Names(Map.of());
        return new Names(users.findAllByIdIncludingInactive(ids).stream().collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a)));
    }

    private record Names(Map<UUID, User> users) {
        String name(UUID id) {
            User user = users.get(id);
            return user == null ? "Membre inconnu" : user.getUsername();
        }
    }

    private static long amount(BankEntry.Kind kind, Long amount) {
        if (amount == null) throw new BadRequestException("Indiquez le montant.");
        if (amount > MAX_AMOUNT || amount < -MAX_AMOUNT) throw new BadRequestException("Montant trop élevé.");
        if (kind == BankEntry.Kind.ADJUSTMENT) {
            if (amount == 0) throw new BadRequestException("Un ajustement ne peut pas être nul.");
        } else if (amount <= 0) {
            throw new BadRequestException("Le montant doit être positif.");
        }
        return amount;
    }

    private static String clean(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > max) throw new BadRequestException("Texte trop long (" + max + " caractères au plus).");
        return trimmed;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value, String message) {
        if (value == null) throw new BadRequestException(message);
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException(message);
        }
    }
}
