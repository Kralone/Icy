package com.icy.icy_backend.service.user;

import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
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
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Trésorier est une fonction : changer le grade la garde, la case la donne ou la retire. */
class UserServiceTreasurerTest {
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final RoleRepository roles = Mockito.mock(RoleRepository.class);
    private UserService service;
    private User member;

    @BeforeEach
    void setUp() {
        service = new UserService(users, Mockito.mock(UserRoleRepository.class), roles, Mockito.mock(PasswordEncoder.class),
                Mockito.mock(MessageService.class), Mockito.mock(UserPublisher.class), Mockito.mock(NotificationPushService.class),
                Mockito.mock(ShipRepository.class), Mockito.mock(UserParamRepository.class), Mockito.mock(UserAvatarService.class),
                Mockito.mock(GoalRepository.class), Mockito.mock(GoalParticipationRepository.class), Mockito.mock(EventParticipationRepository.class),
                Mockito.mock(UserShipRepository.class), Mockito.mock(UserCollectionRepository.class));
        for (String name : Set.of("ASSOCIE", "INGENIEUR", "TRESORIER")) {
            Role role = new Role();
            role.setId(UUID.randomUUID());
            role.setName(name);
            when(roles.findByName(name)).thenReturn(Optional.of(role));
        }
        member = new User();
        member.setId(UUID.randomUUID());
        member.setUsername("Vexa");
        member.setRoles(new HashSet<>());
        when(users.findById(member.getId())).thenReturn(Optional.of(member));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void checkingTreasurerAddsTheFunctionNextToTheRank() {
        service.updateUser(member.getId(), "Vexa", "1", "ASSOCIE", true);

        assertThat(roleNames()).containsExactlyInAnyOrder("ASSOCIE", "TRESORIER");
    }

    @Test
    void changingTheRankKeepsTheTreasurerFunction() {
        service.updateUser(member.getId(), "Vexa", "1", "ASSOCIE", true);

        service.updateUser(member.getId(), "Vexa", "1", "INGENIEUR", null);

        assertThat(roleNames()).containsExactlyInAnyOrder("INGENIEUR", "TRESORIER");
    }

    @Test
    void uncheckingTreasurerRemovesOnlyTheFunction() {
        service.updateUser(member.getId(), "Vexa", "1", "ASSOCIE", true);

        service.updateUser(member.getId(), "Vexa", "1", "ASSOCIE", false);

        assertThat(roleNames()).containsExactly("ASSOCIE");
    }

    @Test
    void treasurerCannotBeGivenAsARank() {
        assertThatThrownBy(() -> service.updateUser(member.getId(), "Vexa", "1", "TRESORIER", null))
                .isInstanceOf(BadRequestException.class);
    }

    private Set<String> roleNames() {
        return member.getRoles().stream().map(UserRole::getRole).map(Role::getName).collect(Collectors.toSet());
    }
}
