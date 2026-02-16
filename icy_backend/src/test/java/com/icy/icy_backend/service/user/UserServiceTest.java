package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserOnlineResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserProfileResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserProfileRequest;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserParam;
import com.icy.icy_backend.db.entity.user.UserStatus;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.goal.GoalParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.collection.UserCollectionRepository;
import com.icy.icy_backend.db.repository.user.RoleRepository;
import com.icy.icy_backend.db.repository.user.UserParamRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.UserPublisher;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {

    @Test
    void getUserByDiscordIdReturnsFoundResponse() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setDiscordId("123");
        when(userRepository.findByDiscordId("123")).thenReturn(Optional.of(user));
        ResponseEntity<MessageResponse<User>> response = okResponse(user);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.found"), eq(user));

        ResponseEntity<MessageResponse<User>> actual = userService.getUserByDiscordId("123");
        assertThat(actual).isEqualTo(response);
    }

    @Test
    void getUserByDiscordIdReturnsNotFoundResponse() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        when(userRepository.findByDiscordId("123")).thenReturn(Optional.empty());
        ResponseEntity<MessageResponse<User>> response = okResponse(null);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.notfound"), eq(null));

        ResponseEntity<MessageResponse<User>> actual = userService.getUserByDiscordId("123");
        assertThat(actual).isEqualTo(response);
    }

    @Test
    void createUserSkipsWhenDiscordIdExists() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        when(userRepository.findByDiscordId("123")).thenReturn(Optional.of(new User()));
        ResponseEntity<MessageResponse<User>> response = okResponse(null);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.createfailed"), eq(null), any());

        ResponseEntity<MessageResponse<User>> actual = userService.createUser("alice", "123", "USER");
        assertThat(actual).isEqualTo(response);
    }

    @Test
    void createUserSavesAndNotifies() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        when(userRepository.findByDiscordId("123")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any())).thenReturn("encoded");
        Role role = new Role();
        role.setName("USER");
        when(roleRepository.findByName("USER")).thenReturn(Optional.of(role));

        User saved = new User();
        saved.setId(UUID.randomUUID());
        saved.setUsername("alice");
        when(userRepository.save(any(User.class))).thenReturn(saved);

        ResponseEntity<MessageResponse<User>> response = okResponse(saved);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.created"), eq(saved));

        ResponseEntity<MessageResponse<User>> actual = userService.createUser("alice", "123", "USER");
        assertThat(actual).isEqualTo(response);
        verify(userPublisher).sendTemporaryPassword(eq("123"), any());
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }

    @Test
    void updatePasswordAndUnlockUpdatesFlags() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setPwdReset(true);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(passwordEncoder.encode("pwd")).thenReturn("encoded");

        String username = userService.updatePasswordAndUnlock(user.getId(), "pwd");
        assertThat(username).isEqualTo("alice");
        verify(notificationPushService).sendToUsers(any(), any(), any(), any(), any());
    }

    @Test
    void resolveUserSupportsUuidAndString() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.findByDiscordId("123")).thenReturn(Optional.of(user));

        assertThat(userService.resolveUser(user.getId())).isEqualTo(user);
        assertThat(userService.resolveUser("123")).isEqualTo(user);
        assertThatThrownBy(() -> userService.resolveUser(1)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getOnlineUsersUpdatesStatusesAndSaves() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.CONNECTE);
        user.setLastSeenAt(LocalDateTime.now().minusHours(2));
        when(userRepository.findAll()).thenReturn(List.of(user));

        ResponseEntity<MessageResponse<List<UserOnlineResponseDTO>>> response = okResponse(List.of(new UserOnlineResponseDTO(user)));
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.online.list"), any());

        ResponseEntity<MessageResponse<List<UserOnlineResponseDTO>>> actual = userService.getOnlineUsers();
        assertThat(actual).isEqualTo(response);
        verify(userRepository).saveAll(any());
    }

    @Test
    void updateCurrentUserProfileUpdatesUserAndParams() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserPublisher userPublisher = Mockito.mock(UserPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        UserParamRepository userParamRepository = Mockito.mock(UserParamRepository.class);
        UserAvatarService userAvatarService = Mockito.mock(UserAvatarService.class);
        GoalRepository goalRepository = Mockito.mock(GoalRepository.class);
        GoalParticipationRepository goalParticipationRepository = Mockito.mock(GoalParticipationRepository.class);
        EventParticipationRepository eventParticipationRepository = Mockito.mock(EventParticipationRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        UserCollectionRepository userCollectionRepository = Mockito.mock(UserCollectionRepository.class);

        UserService userService = new UserService(
                userRepository, userRoleRepository, roleRepository, passwordEncoder,
                messageService, userPublisher, notificationPushService, shipRepository,
                userParamRepository, userAvatarService, goalRepository, goalParticipationRepository, eventParticipationRepository, userShipRepository, userCollectionRepository
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.CONNECTE);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        UserParam userParam = new UserParam();
        userParam.setUser(user);
        when(userParamRepository.findById(user.getId())).thenReturn(Optional.of(userParam));

        Ship ship = new Ship();
        ship.setId(10L);
        when(shipRepository.findById(10L)).thenReturn(Optional.of(ship));

        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setDescription("desc");
        request.setAvatarUrl("avatar");
        request.setFavoriteShipId(10L);
        request.setNotifGlobal(true);

        ResponseEntity<MessageResponse<UserProfileResponseDTO>> response = okResponse(new UserProfileResponseDTO(user, userParam));
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.profile.updated"), any());

        ResponseEntity<MessageResponse<UserProfileResponseDTO>> actual = userService.updateCurrentUserProfile(user.getId(), request);
        assertThat(actual).isEqualTo(response);
        verify(userParamRepository).save(any());
        verify(userRepository).save(any());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
