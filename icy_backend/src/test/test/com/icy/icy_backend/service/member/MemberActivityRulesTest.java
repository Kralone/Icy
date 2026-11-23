package com.icy.icy_backend.service.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos.State;
import com.icy.icy_backend.db.entity.member.MemberActivitySettings;
import com.icy.icy_backend.db.entity.member.MemberFollowUp;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class MemberActivityRulesTest {
    private final LocalDateTime now = LocalDateTime.of(2026, 11, 23, 12, 0);

    @Test
    void theMostRecentOfSiteVisitAndOperationCounts() {
        User user = new User();
        user.setLastSeenAt(now.minusDays(40));
        assertThat(MemberActivityService.lastActivity(user, now.minusDays(3))).isEqualTo(now.minusDays(3));
        assertThat(MemberActivityService.lastActivity(user, null)).isEqualTo(now.minusDays(40));
        user.setLastSeenAt(null);
        assertThat(MemberActivityService.lastActivity(user, null)).isNull();
    }

    @Test
    void aMemberWhoNeverCameCountsFromHisAccountCreation() {
        User user = new User();
        user.setCreatedAt(now.minusDays(20));
        assertThat(MemberActivityService.days(null, user, now)).isEqualTo(20);
    }

    @Test
    void thresholdsSplitActiveWatchedAndInactive() {
        MemberActivitySettings settings = new MemberActivitySettings();
        assertThat(MemberActivityService.computedState(13, settings)).isEqualTo(State.ACTIF);
        assertThat(MemberActivityService.computedState(14, settings)).isEqualTo(State.A_SURVEILLER);
        assertThat(MemberActivityService.computedState(30, settings)).isEqualTo(State.INACTIF);
    }

    @Test
    void aManualCorrectionStopsAfterItsLastDay() {
        MemberFollowUp followUp = MemberFollowUp.builder().manualState(MemberFollowUp.ManualState.EN_PAUSE).manualUntil(LocalDate.of(2026, 12, 31)).build();
        assertThat(followUp.appliesOn(LocalDate.of(2026, 12, 31))).isTrue();
        assertThat(followUp.appliesOn(LocalDate.of(2027, 1, 1))).isFalse();
        followUp.setManualUntil(null);
        assertThat(followUp.appliesOn(LocalDate.of(2030, 1, 1))).isTrue();
    }

    @Test
    void templatesArePersonalisedWithNameRankAndPole() {
        User user = new User();
        user.setUsername("Vexa");
        Role role = new Role();
        role.setName("SPECIALISTE");
        UserRole userRole = new UserRole();
        userRole.setRole(role);
        user.getRoles().add(userRole);
        user.setSpecialty(Specialty.LOGISTIQUE);

        assertThat(MessageTemplateService.render("{pseudo}, Spécialiste {pôle} ({grade})", user, null)).isEqualTo("Vexa, Spécialiste Logistique (Spécialiste)");
        assertThat(MessageTemplateService.render("pôle {pôle}", user, "PROMOTION_SPECIALISTE_MILITAIRE")).isEqualTo("pôle Militaire");
    }
}
