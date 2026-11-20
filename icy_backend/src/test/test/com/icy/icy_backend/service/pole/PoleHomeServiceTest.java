package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.db.entity.pole.PoleNews;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.pole.PoleNewsRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.UserAuthDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PoleHomeServiceTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 20);

    private final PoleService poles = Mockito.mock(PoleService.class);
    private final PoleNewsRepository news = Mockito.mock(PoleNewsRepository.class);
    private final SessionSheetRepository sheets = Mockito.mock(SessionSheetRepository.class);
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final com.icy.icy_backend.db.repository.event.EventRepository events = Mockito.mock(com.icy.icy_backend.db.repository.event.EventRepository.class);
    private final com.icy.icy_backend.db.repository.event.OperationRepository operations = Mockito.mock(com.icy.icy_backend.db.repository.event.OperationRepository.class);
    private final com.icy.icy_backend.db.repository.goal.GoalRepository goals = Mockito.mock(com.icy.icy_backend.db.repository.goal.GoalRepository.class);
    private final PoleHomeService service = new PoleHomeService(poles, news, sheets, users, events, operations, goals);

    @BeforeEach
    void setUp() {
        service.setClock(Clock.fixed(Instant.parse("2026-11-20T10:00:00Z"), ZoneOffset.UTC));
        when(poles.poles()).thenReturn(List.of(
                new PoleDtos.Pole("LOGISTIQUE", List.of()),
                new PoleDtos.Pole("MILITAIRE", List.of()),
                new PoleDtos.Pole("INDUSTRIE", List.of(new PoleDtos.Specialist(UUID.randomUUID(), "Torin", null)))));
        when(news.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void industryHomeShowsReferentsStatsRecentSheetsAndNews() {
        signIn("JUNIOR", null);
        LocalDate since = TODAY.minusDays(30);
        when(sheets.countByActivityAndSessionDateBetween("MINING", since, TODAY)).thenReturn(6L);
        when(sheets.countByActivityAndStatusNot("MINING", SessionSheet.Status.CLOSED)).thenReturn(2L);
        when(sheets.countParticipantsBetween("MINING", since, TODAY)).thenReturn(9L);
        when(sheets.sumSalesSince("MINING", since.atStartOfDay())).thenReturn(1_250_000L);
        SessionSheet sheet = SessionSheet.builder().id(UUID.randomUUID()).name("Quantanium Aaron Halo")
                .sessionDate(TODAY).status(SessionSheet.Status.ACTIVE).build();
        when(sheets.findTop4ByActivityOrderBySessionDateDescCreatedAtDesc("MINING")).thenReturn(List.of(sheet));
        when(news.findTop10ByPoleOrderByCreatedAtDescIdDesc(Specialty.INDUSTRIE)).thenReturn(List.of(entry(7L, Specialty.INDUSTRIE)));

        PoleDtos.Home home = service.home("industrie");

        assertThat(home.key()).isEqualTo("INDUSTRIE");
        assertThat(home.specialists()).extracting(PoleDtos.Specialist::username).containsExactly("Torin");
        assertThat(home.canManage()).isFalse();
        assertThat(home.stats()).containsExactly(
                new PoleDtos.Stat("MINING_SHEETS_30D", 6), new PoleDtos.Stat("MINING_SHEETS_OPEN", 2),
                new PoleDtos.Stat("MINERS_30D", 9), new PoleDtos.Stat("MINING_SALES_30D", 1_250_000));
        assertThat(home.activity()).containsExactly(
                new PoleDtos.Activity("MINING_SHEET", sheet.getId(), "Quantanium Aaron Halo", TODAY, "ACTIVE"));
        assertThat(home.news()).extracting(PoleDtos.News::id).containsExactly(7L);
    }

    @Test
    void polesWithoutOwnToolsCountTheirEventsAndOperations() {
        signIn("JUNIOR", null);
        LocalDateTime now = LocalDateTime.of(2026, 11, 20, 10, 0);
        LocalDateTime since = now.minusDays(30);
        when(events.countEndedOfPoleBetween(Specialty.MILITAIRE, since, now)).thenReturn(3L);
        when(events.countParticipantsOfPoleBetween(Specialty.MILITAIRE, since, now)).thenReturn(11L);
        when(events.countUpcomingOfPole(Specialty.MILITAIRE, now)).thenReturn(2L);
        com.icy.icy_backend.db.entity.event.Event patrol = com.icy.icy_backend.db.entity.event.Event.builder()
                .id(UUID.randomUUID()).title("Patrouille Pyro")
                .activityType(com.icy.icy_backend.db.entity.event.ActivityType.OPERATION)
                .startDateTime(LocalDateTime.of(2026, 11, 14, 21, 0)).endDateTime(LocalDateTime.of(2026, 11, 14, 23, 0)).build();
        when(events.findPastOfPole(Mockito.eq(Specialty.MILITAIRE), Mockito.eq(now), any())).thenReturn(List.of(patrol));

        PoleDtos.Home home = service.home("MILITAIRE");

        assertThat(home.stats()).containsExactly(
                new PoleDtos.Stat("POLE_ACTIVITIES_30D", 3),
                new PoleDtos.Stat("POLE_PARTICIPANTS_30D", 11),
                new PoleDtos.Stat("POLE_UPCOMING", 2));
        assertThat(home.activity()).containsExactly(
                new PoleDtos.Activity("OPERATION", patrol.getId(), "Patrouille Pyro", LocalDate.of(2026, 11, 14), null));
        assertThat(home.news()).isEmpty();
        assertThat(home.agenda()).isEmpty();
    }

    @Test
    void agendaListsUpcomingActivitiesOfThePoleWithTheirImage() {
        signIn("JUNIOR", null);
        com.icy.icy_backend.db.entity.event.EventType type = new com.icy.icy_backend.db.entity.event.EventType();
        type.setName("Minage");
        type.setImageUrl("/images/minage.webp");
        com.icy.icy_backend.db.entity.event.Event outing = com.icy.icy_backend.db.entity.event.Event.builder()
                .id(UUID.randomUUID()).title("Sortie Quantanium").type(type)
                .startDateTime(LocalDateTime.of(2026, 11, 21, 21, 0)).endDateTime(LocalDateTime.of(2026, 11, 21, 23, 0)).build();
        com.icy.icy_backend.db.entity.event.Event operation = com.icy.icy_backend.db.entity.event.Event.builder()
                .id(UUID.randomUUID()).title("Opération Halo").type(type)
                .activityType(com.icy.icy_backend.db.entity.event.ActivityType.OPERATION)
                .startDateTime(LocalDateTime.of(2026, 11, 28, 21, 0)).endDateTime(LocalDateTime.of(2026, 11, 28, 23, 0)).build();
        com.icy.icy_backend.db.entity.event.Operation details = new com.icy.icy_backend.db.entity.event.Operation();
        details.setEventId(operation.getId());
        details.setImageUrl("https://exemple.test/halo.jpg");
        when(events.findUpcomingOfPole(Mockito.eq(Specialty.INDUSTRIE), Mockito.eq(LocalDateTime.of(2026, 11, 20, 10, 0)), any()))
                .thenReturn(List.of(outing, operation));
        when(operations.findAllById(List.of(outing.getId(), operation.getId()))).thenReturn(List.of(details));

        List<PoleDtos.Agenda> agenda = service.home("INDUSTRIE").agenda();

        assertThat(agenda).containsExactly(
                new PoleDtos.Agenda(outing.getId(), "EVENT", "Sortie Quantanium", "Minage", "/images/minage.webp", outing.getStartDateTime(), outing.getEndDateTime()),
                new PoleDtos.Agenda(operation.getId(), "OPERATION", "Opération Halo", "Minage", "https://exemple.test/halo.jpg", operation.getStartDateTime(), operation.getEndDateTime()));
    }

    @Test
    void goalsOfThePoleShowTheProgressOfTheirSteps() {
        signIn("JUNIOR", null);
        com.icy.icy_backend.db.entity.goal.Goal simple = com.icy.icy_backend.db.entity.goal.Goal.builder().id(1L).name("Stock de Quantanium").current(40).target(100).build();
        com.icy.icy_backend.db.entity.goal.Goal staged = com.icy.icy_backend.db.entity.goal.Goal.builder().id(2L).name("Base avancée").current(0).target(1).completed(true)
                .subGoals(List.of(
                        com.icy.icy_backend.db.entity.goal.Goal.builder().id(3L).name("Acier").current(30).target(50).build(),
                        com.icy.icy_backend.db.entity.goal.Goal.builder().id(4L).name("Cuivre").current(20).target(20).build()))
                .build();
        when(goals.findByPoleAndParentIsNullOrderByCompletedAscCreatedAtDesc(Specialty.LOGISTIQUE)).thenReturn(List.of(simple, staged));

        assertThat(service.home("LOGISTIQUE").goals()).containsExactly(
                new PoleDtos.Goal(1L, "Stock de Quantanium", 40, 100, false),
                new PoleDtos.Goal(2L, "Base avancée", 50, 70, true));
    }

    @Test
    void unknownPoleIsNotFound() {
        signIn("ADMIN", null);
        assertThatThrownBy(() -> service.home("finance")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void adminsOfficersAndTheReferentsOfThePoleManageIt() {
        signIn("ADMIN", null);
        assertThat(service.home("LOGISTIQUE").canManage()).isTrue();
        signIn("OFFICIER", null);
        assertThat(service.home("LOGISTIQUE").canManage()).isTrue();
        signIn("SPECIALISTE", Specialty.LOGISTIQUE);
        assertThat(service.home("LOGISTIQUE").canManage()).isTrue();
        assertThat(service.home("MILITAIRE").canManage()).isFalse();
    }

    @Test
    void aReferentPublishesNewsForTheirPoleOnly() {
        User author = signIn("SPECIALISTE", Specialty.INDUSTRIE);

        PoleDtos.News published = service.publish("INDUSTRIE", new PoleDtos.NewsRequest("  Sortie Quantanium  ", " Samedi 21h. "));

        assertThat(published.title()).isEqualTo("Sortie Quantanium");
        assertThat(published.content()).isEqualTo("Samedi 21h.");
        assertThat(published.authorName()).isEqualTo(author.getUsername());
        assertThat(published.createdAt()).isEqualTo(LocalDateTime.of(2026, 11, 20, 10, 0));
        assertThatThrownBy(() -> service.publish("MILITAIRE", new PoleDtos.NewsRequest("Titre", "Texte")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void otherMembersCannotPublishUpdateOrDelete() {
        signIn("INGENIEUR", null);
        PoleDtos.NewsRequest request = new PoleDtos.NewsRequest("Titre", "Texte");
        assertThatThrownBy(() -> service.publish("INDUSTRIE", request)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update("INDUSTRIE", 1L, request)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.delete("INDUSTRIE", 1L)).isInstanceOf(ForbiddenException.class);
        verify(news, never()).save(any());
        verify(news, never()).delete(any());
    }

    @Test
    void newsNeedsATitleAndAText() {
        signIn("ADMIN", null);
        assertThatThrownBy(() -> service.publish("INDUSTRIE", new PoleDtos.NewsRequest(" ", "Texte")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.publish("INDUSTRIE", new PoleDtos.NewsRequest("Titre", null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.publish("INDUSTRIE", new PoleDtos.NewsRequest("x".repeat(121), "Texte")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void newsOfAnotherPoleCannotBeChangedThroughThisPole() {
        signIn("SPECIALISTE", Specialty.INDUSTRIE);
        when(news.findById(3L)).thenReturn(Optional.of(entry(3L, Specialty.MILITAIRE)));
        assertThatThrownBy(() -> service.update("INDUSTRIE", 3L, new PoleDtos.NewsRequest("Titre", "Texte")))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.delete("INDUSTRIE", 3L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateKeepsTheAuthorAndStampsTheChange() {
        signIn("OFFICIER", null);
        PoleNews existing = entry(4L, Specialty.INDUSTRIE);
        when(news.findById(4L)).thenReturn(Optional.of(existing));

        PoleDtos.News updated = service.update("INDUSTRIE", 4L, new PoleDtos.NewsRequest("Nouveau titre", "Nouveau texte"));

        assertThat(updated.title()).isEqualTo("Nouveau titre");
        assertThat(updated.authorName()).isEqualTo("Torin");
        assertThat(updated.updatedAt()).isEqualTo(LocalDateTime.of(2026, 11, 20, 10, 0));
        service.delete("INDUSTRIE", 4L);
        verify(news).delete(existing);
    }

    private User signIn(String role, Specialty specialty) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("membre-" + role.toLowerCase());
        user.setSpecialty(specialty);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(user.getId(), user.getUsername(), "password", List.of()), "",
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        return user;
    }

    private static PoleNews entry(Long id, Specialty pole) {
        PoleNews entry = new PoleNews();
        entry.setId(id);
        entry.setPole(pole);
        entry.setTitle("Titre");
        entry.setContent("Texte");
        entry.setAuthorName("Torin");
        entry.setCreatedAt(LocalDateTime.of(2026, 11, 18, 21, 0));
        return entry;
    }
}
