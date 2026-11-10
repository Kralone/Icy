package com.icy.icy_backend.service.bank;

import com.icy.icy_backend.controller.dto.bank.BankDtos;
import com.icy.icy_backend.db.entity.bank.BankEntry;
import com.icy.icy_backend.db.entity.bank.BankProject;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.bank.BankEntryRepository;
import com.icy.icy_backend.db.repository.bank.BankProjectRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.AuthUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Droits, calcul du solde et annulation des mouvements de la banque de guilde. */
class BankServiceTest {
    static final UUID KRALONE = new UUID(0, 1);
    static final UUID VEXA = new UUID(0, 2);
    static final UUID TORIN = new UUID(0, 3);
    static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 10, 12, 0);

    private final BankEntryRepository entryRepository = mock(BankEntryRepository.class);
    private final BankProjectRepository projectRepository = mock(BankProjectRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ShipRepository ships = mock(ShipRepository.class);
    private final UserRoleRepository userRoles = mock(UserRoleRepository.class);
    private final BankEvents events = mock(BankEvents.class);
    private final MockedStatic<AuthUtils> auth = Mockito.mockStatic(AuthUtils.class);
    private final List<BankEntry> entries = new ArrayList<>();
    private final List<BankProject> projects = new ArrayList<>();
    private final Map<UUID, Set<String>> rolesByUser = new HashMap<>();
    private UUID actor = KRALONE;
    private BankService service;

    @BeforeEach
    void setUp() {
        service = new BankService(entryRepository, projectRepository, users, ships, new BankAccess(userRoles), events);
        service.setClock(Clock.fixed(NOW.atZone(ZoneId.of("Europe/Paris")).toInstant(), ZoneId.of("Europe/Paris")));
        auth.when(AuthUtils::getCurrentUserId).thenAnswer(invocation -> actor);
        when(userRoles.findByUserId(any())).thenAnswer(invocation -> rolesByUser.getOrDefault(invocation.<UUID>getArgument(0), Set.of()).stream().map(name -> {
            Role role = new Role();
            role.setName(name);
            UserRole userRole = new UserRole();
            userRole.setRole(role);
            return userRole;
        }).toList());
        when(entryRepository.findAllByOrderByOccurredOnDescRecordedAtDesc()).thenAnswer(invocation -> entries.stream()
                .sorted(Comparator.comparing(BankEntry::getOccurredOn).thenComparing(BankEntry::getRecordedAt).reversed()).toList());
        when(entryRepository.save(any(BankEntry.class))).thenAnswer(invocation -> {
            BankEntry entry = invocation.getArgument(0);
            if (entry.getId() == null) entry.setId(UUID.randomUUID());
            if (!entries.contains(entry)) entries.add(entry);
            return entry;
        });
        when(entryRepository.findById(any())).thenAnswer(invocation -> entries.stream().filter(entry -> entry.getId().equals(invocation.getArgument(0))).findFirst());
        when(projectRepository.findAllByOrderByCreatedAtDesc()).thenAnswer(invocation -> List.copyOf(projects));
        when(projectRepository.save(any(BankProject.class))).thenAnswer(invocation -> {
            BankProject project = invocation.getArgument(0);
            if (project.getId() == null) project.setId(UUID.randomUUID());
            if (!projects.contains(project)) projects.add(project);
            return project;
        });
        when(projectRepository.findById(any())).thenAnswer(invocation -> projects.stream().filter(project -> project.getId().equals(invocation.getArgument(0))).findFirst());
        when(users.findById(any())).thenAnswer(invocation -> Optional.of(user(invocation.getArgument(0))));
        when(users.findAllByIdIncludingInactive(any())).thenAnswer(invocation -> {
            List<User> found = new ArrayList<>();
            for (Object id : (Collection<?>) invocation.getArgument(0)) found.add(user((UUID) id));
            return found;
        });
        rolesByUser.put(KRALONE, Set.of("ASSOCIE", "TRESORIER"));
        rolesByUser.put(VEXA, Set.of("ASSOCIE"));
        rolesByUser.put(TORIN, Set.of("SPECIALISTE"));
    }

    @AfterEach
    void close() {
        auth.close();
    }

    // ----- Droits -----

    @Test
    void treasurerRecordsADepositAndTheBankAnnouncesIt() {
        BankDtos.Entry entry = service.record(new BankDtos.EntryRequest("DEPOSIT", 500_000L, VEXA, null, "Don du week-end", null));

        assertThat(entry.userName()).isEqualTo("Vexa");
        assertThat(entry.occurredOn()).isEqualTo(NOW.toLocalDate());
        assertThat(entry.recordedByName()).isEqualTo("Kralone");
        verify(events).changed();
    }

    @Test
    void plainMemberCannotRecordNorReadDetails() {
        actor = VEXA;

        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("DEPOSIT", 1L, VEXA, null, null, null))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.details()).isInstanceOf(ForbiddenException.class);
        assertThat(entries).isEmpty();
    }

    @Test
    void onlyWritersListMembersForTheEntryForm() {
        when(users.findAll()).thenReturn(List.of(user(VEXA), user(TORIN)));

        assertThat(service.members()).extracting(BankDtos.Member::name).containsExactly("Torin", "Vexa");
        actor = TORIN;
        assertThatThrownBy(() -> service.members()).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void specialistReadsDetailsButCannotRecord() {
        deposit(VEXA, 100L, null);
        actor = TORIN;

        assertThat(service.details().entries()).hasSize(1);
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("DEPOSIT", 1L, VEXA, null, null, null))).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void everyMemberSeesTheBalanceWithoutNamesButWithTheirOwnHistory() {
        deposit(VEXA, 300_000L, null);
        deposit(TORIN, 200_000L, null);
        actor = VEXA;

        BankDtos.Overview overview = service.overview();

        assertThat(overview.access()).isEqualTo(new BankDtos.Access(false, false));
        assertThat(overview.totals().balance()).isEqualTo(500_000L);
        assertThat(overview.totals().donors()).isEqualTo(2);
        assertThat(overview.mine().given()).isEqualTo(300_000L);
        assertThat(overview.mine().entries()).hasSize(1);
    }

    // ----- Solde et projets -----

    @Test
    void balanceCountsDepositsMinusExpensesAndPayoutsPlusSignedAdjustments() {
        deposit(VEXA, 1_000_000L, null);
        service.record(new BankDtos.EntryRequest("EXPENSE", 250_000L, null, null, "Carburant", null));
        service.record(new BankDtos.EntryRequest("PAYOUT", 100_000L, TORIN, null, null, null));
        service.record(new BankDtos.EntryRequest("ADJUSTMENT", -5_000L, null, null, "Écart constaté en jeu", null));

        BankDtos.Totals totals = service.overview().totals();

        assertThat(totals.balance()).isEqualTo(645_000L);
        assertThat(totals.deposits()).isEqualTo(1_000_000L);
        assertThat(totals.expenses()).isEqualTo(250_000L);
        assertThat(totals.payouts()).isEqualTo(100_000L);
    }

    @Test
    void cancelledEntryStaysVisibleButNoLongerCounts() {
        BankDtos.Entry entry = deposit(VEXA, 400_000L, null);

        service.cancel(entry.id(), new BankDtos.CancelRequest("Saisi deux fois"));

        assertThat(service.overview().totals().balance()).isZero();
        assertThat(service.details().entries()).singleElement().satisfies(view -> {
            assertThat(view.cancelled()).isTrue();
            assertThat(view.cancelReason()).isEqualTo("Saisi deux fois");
            assertThat(view.cancelledByName()).isEqualTo("Kralone");
        });
    }

    @Test
    void cancellingNeedsAReasonAndHappensOnce() {
        BankDtos.Entry entry = deposit(VEXA, 400_000L, null);

        assertThatThrownBy(() -> service.cancel(entry.id(), new BankDtos.CancelRequest("  "))).isInstanceOf(BadRequestException.class);
        service.cancel(entry.id(), new BankDtos.CancelRequest("Erreur"));
        assertThatThrownBy(() -> service.cancel(entry.id(), new BankDtos.CancelRequest("Encore"))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void projectShowsWhatWasCollectedSpentAndWhoContributed() {
        BankDtos.Project carrack = service.createProject(new BankDtos.ProjectRequest("Achat Carrack", null, 2_000_000L, null, null));
        deposit(VEXA, 800_000L, carrack.id());
        deposit(TORIN, 400_000L, carrack.id());
        deposit(VEXA, 100_000L, null);
        service.record(new BankDtos.EntryRequest("EXPENSE", 300_000L, null, carrack.id(), null, null));

        BankDtos.Project view = service.overview().projects().getFirst();

        assertThat(view.collected()).isEqualTo(1_200_000L);
        assertThat(view.spent()).isEqualTo(300_000L);
        assertThat(view.available()).isEqualTo(900_000L);
        assertThat(view.contributors()).isEqualTo(2);
    }

    @Test
    void cancelledProjectRefusesNewMovements() {
        BankDtos.Project project = service.createProject(new BankDtos.ProjectRequest("Idris", null, null, null, null));
        service.updateProject(project.id(), new BankDtos.ProjectRequest("Idris", null, null, null, "CANCELLED"));

        assertThatThrownBy(() -> deposit(VEXA, 10L, project.id())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void monthsCoverTheLastYearWithTheBalanceAtEachMonthEnd() {
        deposit(VEXA, 100L, null, LocalDate.of(2025, 6, 1));
        deposit(VEXA, 50L, null, LocalDate.of(2026, 10, 3));
        deposit(VEXA, 20L, null, LocalDate.of(2026, 11, 2));

        List<BankDtos.MonthPoint> months = service.overview().months();

        assertThat(months).hasSize(12);
        assertThat(months.getFirst().month()).isEqualTo("2025-12");
        assertThat(months.getFirst().balance()).isEqualTo(100L);
        assertThat(months.get(10)).extracting(BankDtos.MonthPoint::deposits, BankDtos.MonthPoint::balance).containsExactly(50L, 150L);
        assertThat(months.getLast().balance()).isEqualTo(170L);
    }

    // ----- Saisie -----

    @Test
    void depositNeedsAPlayerAndAPositiveAmount() {
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("DEPOSIT", 10L, null, null, null, null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("DEPOSIT", -10L, VEXA, null, null, null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("DEPOSIT", 10L, VEXA, null, null, NOW.toLocalDate().plusDays(5)))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void expenseWithoutProjectNeedsANoteAndAdjustmentAlwaysNeedsOne() {
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("EXPENSE", 10L, null, null, null, null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("ADJUSTMENT", 10L, null, null, " ", null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.record(new BankDtos.EntryRequest("ADJUSTMENT", 0L, null, null, "rien", null))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void playersAreRankedByWhatTheyGave() {
        deposit(VEXA, 100L, null);
        deposit(TORIN, 300L, null);
        service.record(new BankDtos.EntryRequest("PAYOUT", 40L, VEXA, null, null, null));

        List<BankDtos.Player> players = service.details().players();

        assertThat(players).extracting(BankDtos.Player::userName).containsExactly("Torin", "Vexa");
        assertThat(players.get(1).received()).isEqualTo(40L);
    }

    private BankDtos.Entry deposit(UUID player, long amount, UUID projectId) {
        return service.record(new BankDtos.EntryRequest("DEPOSIT", amount, player, projectId, null, null));
    }

    private void deposit(UUID player, long amount, UUID projectId, LocalDate on) {
        service.record(new BankDtos.EntryRequest("DEPOSIT", amount, player, projectId, null, on));
    }

    private static User user(UUID id) {
        User user = new User();
        user.setId(id);
        user.setUsername(id.equals(KRALONE) ? "Kralone" : id.equals(VEXA) ? "Vexa" : id.equals(TORIN) ? "Torin" : "Autre");
        return user;
    }
}
