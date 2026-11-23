package com.icy.icy_backend.service.moderation;

import com.icy.icy_backend.controller.dto.moderation.ModerationDtos;
import com.icy.icy_backend.db.entity.moderation.DeliveryStatus;
import com.icy.icy_backend.db.entity.moderation.MemberSanction;
import com.icy.icy_backend.db.entity.moderation.MemberWarning;
import com.icy.icy_backend.db.entity.moderation.SanctionDecision;
import com.icy.icy_backend.db.entity.moderation.WarningCategory;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.moderation.MemberSanctionRepository;
import com.icy.icy_backend.db.repository.moderation.MemberWarningRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberWarningServiceTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 23, 10, 0);

    private final MemberWarningRepository warnings = Mockito.mock(MemberWarningRepository.class);
    private final MemberSanctionRepository sanctions = Mockito.mock(MemberSanctionRepository.class);
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final ModerationMessenger messenger = Mockito.mock(ModerationMessenger.class);
    private final NotificationPushService notifications = Mockito.mock(NotificationPushService.class);
    private final MemberWarningService service = new MemberWarningService(warnings, sanctions, users, messenger, notifications);

    private final List<MemberWarning> stored = new ArrayList<>();
    private final List<MemberSanction> storedSanctions = new ArrayList<>();
    private User officer;
    private User director;
    private User member;

    @BeforeEach
    void setUp() {
        service.setClock(Clock.fixed(NOW.toInstant(ZoneOffset.UTC), ZoneOffset.UTC));
        service.setThreshold(3);
        officer = user("Vexa", "OFFICIER");
        director = user("Kralone", "ADMIN");
        member = user("Torin", "JUNIOR");
        for (User user : List.of(officer, director, member)) {
            when(users.findById(user.getId())).thenAnswer(call -> Boolean.TRUE.equals(user.getActive()) ? Optional.of(user) : Optional.empty());
            when(users.findByIdIncludingInactive(user.getId())).thenReturn(Optional.of(user));
        }
        when(users.findAllByRoleName("ADMIN")).thenReturn(List.of(director));
        when(messenger.send(anyString(), any())).thenAnswer(call -> UUID.randomUUID());
        when(warnings.save(any())).thenAnswer(call -> {
            MemberWarning warning = call.getArgument(0);
            if (warning.getId() == null) {
                warning.setId((long) stored.size() + 1);
                stored.add(warning);
            }
            return warning;
        });
        when(warnings.findByUserIdOrderByCreatedAtDescIdDesc(any())).thenAnswer(call -> stored.stream()
                .filter(w -> w.getUserId().equals(call.getArgument(0)))
                .sorted((a, b) -> b.getId().compareTo(a.getId())).toList());
        when(warnings.countByUserIdAndRevokedAtIsNull(any())).thenAnswer(call -> stored.stream()
                .filter(w -> w.getUserId().equals(call.getArgument(0)) && w.isActive()).count());
        when(warnings.findById(any())).thenAnswer(call -> stored.stream().filter(w -> w.getId().equals(call.getArgument(0))).findFirst());
        when(warnings.findByRevokedAtIsNull()).thenAnswer(call -> stored.stream().filter(MemberWarning::isActive).toList());
        when(warnings.findByDmDeliveryId(any())).thenAnswer(call -> stored.stream().filter(w -> call.getArgument(0).equals(w.getDmDeliveryId())).findFirst());
        when(sanctions.save(any())).thenAnswer(call -> {
            MemberSanction sanction = call.getArgument(0);
            if (sanction.getId() == null) {
                sanction.setId((long) storedSanctions.size() + 1);
                storedSanctions.add(sanction);
            }
            return sanction;
        });
        when(sanctions.findByUserIdOrderByCreatedAtDescIdDesc(any())).thenAnswer(call -> storedSanctions.stream()
                .filter(s -> s.getUserId().equals(call.getArgument(0))).toList());
        when(sanctions.findByUserIdIn(any())).thenAnswer(call -> List.copyOf(storedSanctions));
        when(sanctions.findById(any())).thenAnswer(call -> storedSanctions.stream().filter(s -> s.getId().equals(call.getArgument(0))).findFirst());
        when(sanctions.findByDecisionAndDiscordBanDoneAtIsNullOrderByCreatedAtAsc(SanctionDecision.EXCLUDE)).thenAnswer(call -> storedSanctions.stream()
                .filter(s -> s.getDecision() == SanctionDecision.EXCLUDE && s.getDiscordBanDoneAt() == null).toList());
        when(users.findAllByIdIncludingInactive(any())).thenReturn(List.of(member));
        signIn(officer);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void warningCountsUpAndSendsTheReasonAndRankToTheMember() {
        service.warn(member.getId(), new ModerationDtos.WarningRequest("comportement", "  Insultes en vocal  "));
        ModerationDtos.Record record = service.warn(member.getId(), new ModerationDtos.WarningRequest("ABSENCE", "Absent à l'opération"));

        assertThat(record.activeWarnings()).isEqualTo(2);
        assertThat(record.warnings()).extracting(ModerationDtos.Warning::rank).containsExactly(2, 1);
        assertThat(record.warnings().get(1).reason()).isEqualTo("Insultes en vocal");
        assertThat(record.warnings()).allMatch(w -> w.dmStatus().equals("PENDING") && w.issuedByName().equals("Vexa"));
        assertThat(record.pendingDecision()).isFalse();

        ArgumentCaptor<ModerationMessage> message = ArgumentCaptor.forClass(ModerationMessage.class);
        verify(messenger, Mockito.times(2)).send(eq(member.getDiscordId()), message.capture());
        ModerationMessage second = message.getAllValues().get(1);
        assertThat(second.title()).isEqualTo("⚠️ 2e avertissement");
        assertThat(second.description()).contains("**Motif : Absence sans prévenir**", "> Absent à l'opération",
                "Au prochain, la direction décidera de ton exclusion");
        assertThat(second.color()).isEqualTo(WarningMessages.ORANGE);
        verify(notifications, never()).sendToUsers(anyList(), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void thirdWarningOpensADecisionAndAlertsDirectors() {
        warnTimes(3);

        ModerationDtos.Record record = service.record(member.getId());
        assertThat(record.pendingDecision()).isTrue();
        assertThat(record.canDecide()).isFalse();
        verify(notifications).sendToUsers(eq(List.of(director.getId())), eq("Exclusion à décider"),
                eq("Torin a reçu son 3e avertissement."), eq("/icy/admin/members?discipline=" + member.getId()), eq(3));
        assertThat(service.summary().members()).singleElement()
                .satisfies(standing -> {
                    assertThat(standing.activeWarnings()).isEqualTo(3);
                    assertThat(standing.pendingDecision()).isTrue();
                });
    }

    @Test
    void reasonAndCategoryAreRequired() {
        assertThatThrownBy(() -> service.warn(member.getId(), new ModerationDtos.WarningRequest("COMPORTEMENT", "  ")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.warn(member.getId(), new ModerationDtos.WarningRequest("INCONNU", "Motif")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.warn(member.getId(), new ModerationDtos.WarningRequest("AUTRE", "x".repeat(1001))))
                .isInstanceOf(BadRequestException.class);
        verify(warnings, never()).save(any());
    }

    @Test
    void anOfficerCannotWarnAnotherOfficerOrHimself() {
        User other = user("Rho", "OFFICIER");
        when(users.findById(other.getId())).thenReturn(Optional.of(other));
        when(users.findByIdIncludingInactive(other.getId())).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.warn(other.getId(), new ModerationDtos.WarningRequest("AUTRE", "Motif")))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.warn(officer.getId(), new ModerationDtos.WarningRequest("AUTRE", "Motif")))
                .isInstanceOf(ForbiddenException.class);
        assertThat(service.record(other.getId()).canWarn()).isFalse();
    }

    @Test
    void revokedWarningStopsCountingAndTheMemberIsTold() {
        warnTimes(2);
        Long firstId = stored.get(0).getId();

        ModerationDtos.Record record = service.revoke(firstId, new ModerationDtos.RevokeRequest("Erreur de personne", null));

        assertThat(record.activeWarnings()).isEqualTo(1);
        assertThat(record.warnings().get(1).active()).isFalse();
        assertThat(record.warnings().get(1).revokedByName()).isEqualTo("Vexa");
        ArgumentCaptor<ModerationMessage> message = ArgumentCaptor.forClass(ModerationMessage.class);
        verify(messenger, Mockito.times(3)).send(eq(member.getDiscordId()), message.capture());
        assertThat(message.getValue().title()).isEqualTo("✅ Avertissement levé");
        assertThat(message.getValue().description()).contains("> Erreur de personne", "Il te reste 1 avertissement en cours.");

        // Le suivant reprend le compte des avertissements en cours.
        service.warn(member.getId(), new ModerationDtos.WarningRequest("AUTRE", "Nouveau"));
        assertThat(stored.get(2).getRank()).isEqualTo(2);

        assertThatThrownBy(() -> service.revoke(firstId, null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void revokeWithoutNoticeSendsNothing() {
        warnTimes(1);
        service.revoke(stored.get(0).getId(), new ModerationDtos.RevokeRequest(null, false));
        verify(messenger, Mockito.times(1)).send(anyString(), any());
    }

    @Test
    void onlyADirectorDecidesAndOnlyAtTheThreshold() {
        warnTimes(2);
        assertThatThrownBy(() -> service.decide(member.getId(), new ModerationDtos.DecisionRequest("EXCLUDE", null, true)))
                .isInstanceOf(ForbiddenException.class);
        signIn(director);
        assertThatThrownBy(() -> service.decide(member.getId(), new ModerationDtos.DecisionRequest("EXCLUDE", null, true)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void exclusionDeactivatesTheAccountTellsTheMemberAndWaitsForTheManualDiscordBan() {
        warnTimes(3);
        signIn(director);

        ModerationDtos.Record record = service.decide(member.getId(), new ModerationDtos.DecisionRequest("EXCLUDE", "Récidive", true));

        assertThat(member.getActive()).isFalse();
        verify(users).save(member);
        assertThat(record.active()).isFalse();
        assertThat(record.pendingDecision()).isFalse();
        assertThat(record.sanctions()).singleElement().satisfies(s -> {
            assertThat(s.decision()).isEqualTo("EXCLUDE");
            assertThat(s.decidedByName()).isEqualTo("Kralone");
            assertThat(s.dmStatus()).isEqualTo("PENDING");
            assertThat(s.discordBanDoneAt()).isNull();
        });
        ArgumentCaptor<ModerationMessage> message = ArgumentCaptor.forClass(ModerationMessage.class);
        verify(messenger, Mockito.times(4)).send(eq(member.getDiscordId()), message.capture());
        assertThat(message.getValue().description()).contains("Après 3 avertissements", "> Récidive");

        assertThat(service.summary().discordBansToDo()).singleElement()
                .satisfies(task -> assertThat(task.username()).isEqualTo("Torin"));

        ModerationDtos.Record confirmed = service.confirmDiscordBan(record.sanctions().get(0).id());
        assertThat(confirmed.sanctions().get(0).discordBanDoneBy()).isEqualTo("Kralone");
        assertThat(service.summary().discordBansToDo()).isEmpty();
    }

    @Test
    void aLastChanceKeepsTheMemberUntilTheNextWarning() {
        warnTimes(3);
        signIn(director);
        service.decide(member.getId(), new ModerationDtos.DecisionRequest("KEEP", null, false));

        assertThat(member.getActive()).isTrue();
        assertThat(service.record(member.getId()).pendingDecision()).isFalse();
        verify(messenger, Mockito.times(3)).send(anyString(), any());

        signIn(officer);
        // L'horloge avance : le 4e avertissement est postérieur à la décision.
        service.setClock(Clock.fixed(NOW.plusDays(2).toInstant(ZoneOffset.UTC), ZoneOffset.UTC));
        service.warn(member.getId(), new ModerationDtos.WarningRequest("AUTRE", "Encore"));
        ModerationDtos.Record record = service.record(member.getId());
        assertThat(record.pendingDecision()).isTrue();
        assertThat(stored.get(3).getRank()).isEqualTo(4);
    }

    @Test
    void botResultIsAttachedToTheWarningAndAFailedMessageCanBeResent() {
        warnTimes(1);
        MemberWarning warning = stored.get(0);

        assertThat(service.recordDelivery(warning.getDmDeliveryId(), false, "dm_closed")).isTrue();
        assertThat(warning.getDmStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(warning.getDmFailure()).isEqualTo("dm_closed");
        assertThat(service.recordDelivery(UUID.randomUUID(), true, null)).isFalse();

        UUID first = warning.getDmDeliveryId();
        service.resend(warning.getId());
        assertThat(warning.getDmStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(warning.getDmDeliveryId()).isNotEqualTo(first);
        assertThatThrownBy(() -> service.resend(warning.getId())).isInstanceOf(BadRequestException.class);

        service.recordDelivery(warning.getDmDeliveryId(), true, null);
        assertThat(warning.getDmStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(warning.getDmFailure()).isNull();
    }

    @Test
    void messagesFollowTheThreshold() {
        assertThat(WarningMessages.consequence(1, 3)).isEqualTo("C'est ton 1er avertissement sur 3. Au 3e, la direction décide de ton exclusion de la corporation.");
        assertThat(WarningMessages.consequence(3, 3)).isEqualTo("C'est ton 3e avertissement : la direction va décider de ton exclusion de la corporation.");
        assertThat(WarningMessages.color(1, 3)).isEqualTo(WarningMessages.AMBER);
        assertThat(WarningMessages.color(4, 3)).isEqualTo(WarningMessages.RED);
        assertThat(WarningMessages.quote("a\nb")).isEqualTo("> a\n> b");
    }

    private void warnTimes(int count) {
        for (int i = 0; i < count; i++) {
            service.warn(member.getId(), new ModerationDtos.WarningRequest(WarningCategory.COMPORTEMENT.name(), "Motif " + (i + 1)));
        }
    }

    private static User user(String name, String roleName) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(name);
        user.setDiscordId(String.valueOf(Math.abs(name.hashCode())));
        user.setActive(true);
        Role role = new Role();
        role.setName(roleName);
        UserRole link = new UserRole();
        link.setUser(user);
        link.setRole(role);
        user.getRoles().add(link);
        return user;
    }

    private static void signIn(User user) {
        String role = user.getRoles().iterator().next().getRole().getName();
        UserAuthDetails details = new UserAuthDetails(user.getId(), user.getUsername(), "password", List.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(details, "",
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
