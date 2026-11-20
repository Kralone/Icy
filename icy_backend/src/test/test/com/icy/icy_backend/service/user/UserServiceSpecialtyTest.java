package com.icy.icy_backend.service.user;

import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.collection.UserCollectionRepository;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.goal.GoalParticipationRepository;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.user.*;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.messaging.UserPublisher;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Le pôle est un sous-grade : obligatoire pour un Spécialiste, absent pour tout autre grade. */
class UserServiceSpecialtyTest {
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final RoleRepository roles = Mockito.mock(RoleRepository.class);
    private final UserPublisher publisher = Mockito.mock(UserPublisher.class);
    private UserService service;
    private User member;

    @BeforeEach
    void setUp() {
        PasswordEncoder encoder = Mockito.mock(PasswordEncoder.class);
        when(encoder.encode(any())).thenReturn("hash");
        service = new UserService(users, Mockito.mock(UserRoleRepository.class), roles, encoder,
                Mockito.mock(MessageService.class), publisher, Mockito.mock(NotificationPushService.class),
                Mockito.mock(ShipRepository.class), Mockito.mock(UserParamRepository.class), Mockito.mock(UserAvatarService.class),
                Mockito.mock(GoalRepository.class), Mockito.mock(GoalParticipationRepository.class), Mockito.mock(EventParticipationRepository.class),
                Mockito.mock(UserShipRepository.class), Mockito.mock(UserCollectionRepository.class));
        for (String name : Set.of("ASSOCIE", "SPECIALISTE", "OFFICIER")) {
            Role role = new Role();
            role.setId(UUID.randomUUID());
            role.setName(name);
            when(roles.findByName(name)).thenReturn(Optional.of(role));
        }
        member = new User();
        member.setId(UUID.randomUUID());
        member.setUsername("Torin");
        member.setRoles(new HashSet<>());
        when(users.findById(member.getId())).thenReturn(Optional.of(member));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(users.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void specialistNeedsAPole() {
        assertThatThrownBy(() -> service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "  "))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "DIPLOMATIE"))
                .isInstanceOf(BadRequestException.class);

        assertThat(member.getRoles()).isEmpty();
        verify(users, never()).save(any(User.class));
    }

    @Test
    void poleIsStoredAndCanChange() {
        service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "industrie");
        assertThat(member.getSpecialty()).isEqualTo(Specialty.INDUSTRIE);

        service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "MILITAIRE");
        assertThat(member.getSpecialty()).isEqualTo(Specialty.MILITAIRE);
    }

    @Test
    void poleIsKeptWhenNotSentAgain() {
        service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "LOGISTIQUE");

        service.updateUser(member.getId(), "Torin le Grand", "1", "SPECIALISTE", null, null);

        assertThat(member.getSpecialty()).isEqualTo(Specialty.LOGISTIQUE);
    }

    @Test
    void poleIsClearedWhenRankChanges() {
        service.updateUser(member.getId(), "Torin", "1", "SPECIALISTE", null, "LOGISTIQUE");

        service.updateUser(member.getId(), "Torin", "1", "OFFICIER", null, "LOGISTIQUE");
        assertThat(member.getSpecialty()).isNull();

        service.updateUser(member.getId(), "Torin", "1", "ASSOCIE", null, null);
        assertThat(member.getSpecialty()).isNull();
    }

    @Test
    void specialistIsCreatedWithItsPole() {
        when(users.findByDiscordIdIncludingInactive("42")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createUser("Nyx", "42", "SPECIALISTE", null))
                .isInstanceOf(BadRequestException.class);
        verify(users, never()).saveAndFlush(any(User.class));
        verify(publisher, never()).sendTemporaryPassword(any(), any(), any());

        service.createUser("Nyx", "42", "SPECIALISTE", "MILITAIRE");
        org.mockito.ArgumentCaptor<User> saved = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSpecialty()).isEqualTo(Specialty.MILITAIRE);

        service.createUser("Kael", "42", "ASSOCIE", "MILITAIRE");
        verify(users, Mockito.times(2)).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSpecialty()).isNull();
    }
}
