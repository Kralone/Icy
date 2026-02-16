package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserOnlineResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserProfileResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserQuickStatsResponseDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserProfileRequest;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserParam;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.entity.user.UserStatus;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.RoleRepository;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
import com.icy.icy_backend.db.repository.user.UserParamRepository;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.goal.GoalParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.db.repository.collection.UserCollectionRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.UserPublisher;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.common.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.stream.StreamSupport;
import java.io.IOException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserService {
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final String DEFAULT_ROLE_NAME = "JUNIOR";
    private static final Duration ACTIVITY_TOUCH_INTERVAL = Duration.ofSeconds(30);
    private static final Duration ABSENT_THRESHOLD = Duration.ofMinutes(10);
    private static final Duration OFFLINE_THRESHOLD = Duration.ofMinutes(60);

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final MessageService messageService;
    private final UserPublisher userPublisher;
    private final NotificationPushService notificationPushService;
    private final ShipRepository shipRepository;
    private final UserParamRepository userParamRepository;
    private final UserAvatarService userAvatarService;
    private final GoalRepository goalRepository;
    private final GoalParticipationRepository goalParticipationRepository;
    private final EventParticipationRepository eventParticipationRepository;
    private final UserShipRepository userShipRepository;
    private final UserCollectionRepository userCollectionRepository;

    public UserService(UserRepository userRepository, UserRoleRepository userRoleRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder, MessageService messageService, UserPublisher userPublisher, NotificationPushService notificationPushService, ShipRepository shipRepository, UserParamRepository userParamRepository, UserAvatarService userAvatarService, GoalRepository goalRepository, GoalParticipationRepository goalParticipationRepository, EventParticipationRepository eventParticipationRepository, UserShipRepository userShipRepository, UserCollectionRepository userCollectionRepository) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.messageService = messageService;
        this.userPublisher = userPublisher;
        this.notificationPushService = notificationPushService;
        this.shipRepository = shipRepository;
        this.userParamRepository = userParamRepository;
        this.userAvatarService = userAvatarService;
        this.goalRepository = goalRepository;
        this.goalParticipationRepository = goalParticipationRepository;
        this.eventParticipationRepository = eventParticipationRepository;
        this.userShipRepository = userShipRepository;
        this.userCollectionRepository = userCollectionRepository;
    }

    /**
     * Récupère un utilisateur via son Discord ID.
     */
    public ResponseEntity<MessageResponse<User>> getUserByDiscordId(String discordId) {
        logger.info("Recherche de l'utilisateur avec Discord ID: {}", discordId);
        try {
            User user = findUserByDiscordId(discordId);
            return messageService.buildResponse("user.found", user);
        } catch (ResourceNotFoundException e) {
            return messageService.buildResponse("user.notfound", null);
        }
    }

    /**
     * Crée un nouvel utilisateur s'il n'existe pas déjà.
     */
    public ResponseEntity<MessageResponse<User>> createUser(String username, String discordId, String role) {
        logger.info("Création d'un nouvel utilisateur: {} avec Discord ID: {}", username, discordId);

        if (userRepository.findByDiscordId(discordId).isPresent()) {
            logger.warn("Un utilisateur avec Discord ID {} existe déjà", discordId);

            return messageService.buildResponse("user.createfailed", null,
                    "L'utilisateur avec le Discord ID " + discordId + " existe déjà.");
        }

        User user = new User();
        user.setUsername(username);
        user.setDiscordId(discordId);
        String tempPassword = UUID.randomUUID().toString().substring(0, 8);
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setPwdReset(true);

        userPublisher.sendTemporaryPassword(discordId, tempPassword);

        String roleName = (role == null || role.isBlank()) ? DEFAULT_ROLE_NAME : role;
        Role defaultRole = findRoleByName(roleName);
        user.assignDefaultRole(defaultRole);

        User savedUser = userRepository.save(user);
        logger.info("Utilisateur créé avec succès: {}", savedUser.getId());
        notificationPushService.sendBroadcast(
                "Membre : nouveau",
                savedUser.getUsername() + " a rejoint IceForge.",
                "/icy/dashboard",
                1
        );

        return messageService.buildResponse("user.created", savedUser);
    }

    public String updatePasswordAndUnlock(UUID id, String newPassword) {
        User user = findUserById(id);
        logger.info("Réinitialisation du mot de passe pour {}", id);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPwdReset(false);
        userRepository.save(user);
        notificationPushService.sendToUsers(
                List.of(id),
                "Compte : mot de passe mis a jour",
                "Le mot de passe a ete mis a jour.",
                "/icy/dashboard",
                2
        );

        return user.getUsername();
    }

    /**
     * Désactive un utilisateur via son ID.
     */
    public ResponseEntity<MessageResponse<Void>> deactivateUser(User user) {
        logger.info("Désactivation de l'utilisateur DiscordId: {}", user.getUsername());
        try {
            user.setActive(false);
            userRepository.save(user);
            logger.info("Utilisateur désactivé avec succès: {}", user.getUsername());
            notifyAdmins(
                    "Admin : compte desactive",
                    "Le compte de " + user.getUsername() + " a ete desactive.",
                    "/icy/admin/members",
                    3
            );
            return messageService.buildResponse("user.deleted", null);
        } catch (ResourceNotFoundException e) {
            return messageService.buildResponse("user.notfound", null);
        }
    }

    public User resolveUser(Object identifier) {
        if (identifier instanceof UUID uuid) {
            return findUserById(uuid);
        } else if (identifier instanceof CharSequence discordId) {
            return findUserByDiscordId(discordId.toString());
        } else if (identifier instanceof Number discordId) {
            return findUserByDiscordId(String.valueOf(discordId));
        }

        logger.error("Type d'identifiant utilisateur non pris en charge : {}", identifier);
        throw new IllegalArgumentException("Identifiant utilisateur invalide : " + identifier);
    }



    /**
     * Trouve un utilisateur via son ID, ou lève une exception s'il n'existe pas.
     */
    public User findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> {
                    logger.warn("Utilisateur introuvable avec ID: {}", userId);
                    return new ResourceNotFoundException("Utilisateur introuvable avec ID: " + userId);
                });
    }

    public User getByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> {
                    logger.warn("Aucun utilisateur trouvé avec le nom d'utilisateur : {}", username);
                    return new ResourceNotFoundException("Utilisateur non trouvé : " + username);
                });
    }


    /**
     * Trouve un utilisateur via son Discord ID, ou lève une exception s'il n'existe pas.
     */
    protected User findUserByDiscordId(String discordId) {
        return userRepository.findByDiscordId(discordId)
                .orElseThrow(() -> {
                    logger.warn("Aucun utilisateur trouvé avec Discord ID: {}", discordId);
                    return new ResourceNotFoundException("Aucun utilisateur trouvé avec Discord ID: " + discordId);
                });
    }

    /**
     * Trouve un rôle via son nom, ou lève une exception s'il n'existe pas.
     */
    protected Role findRoleByName(String roleName) {
        return roleRepository.findByName(roleName)
                .orElseThrow(() -> {
                    logger.warn("Rôle '{}' introuvable", roleName);
                    return new ResourceNotFoundException("Rôle '" + roleName + "' introuvable");
                });
    }

    public ResponseEntity<MessageResponse<List<UserResponseDTO>>> getAllActiveUsers() {
        logger.info("Récupération de tous les utilisateurs actifs");

        Iterable<User> users = userRepository.findAll(); // Les users actifs uniquement via @SQLRestriction

        List<UserResponseDTO> userDtos = StreamSupport.stream(users.spliterator(), false)
                .map(UserResponseDTO::new)
                .toList();

        return messageService.buildResponse("user.list", userDtos);
    }

    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> getCurrentUserProfile(UUID userId) {
        User user = findUserById(userId);
        touchUserActivity(user, LocalDateTime.now());
        userRepository.save(user);
        UserParam userParam = getOrCreateUserParam(user);
        return messageService.buildResponse("user.profile.get", new UserProfileResponseDTO(user, userParam));
    }

    public ResponseEntity<MessageResponse<UserQuickStatsResponseDTO>> getCurrentUserQuickStats(UUID userId) {
        long missions = goalParticipationRepository.countDistinctGoalsByUserId(userId);
        long events = eventParticipationRepository.countByUser_IdAndStatusAndEvent_FinishedTrue(userId, 1);
        long ships = userShipRepository.countByUser_Id(userId);
        long collections = userCollectionRepository.countByUserId(userId.toString());
        return messageService.buildResponse("user.stats.get", new UserQuickStatsResponseDTO(missions, events, ships, collections));
    }

    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> updateCurrentUserProfile(UUID userId, UpdateUserProfileRequest request) {
        User user = findUserById(userId);
        touchUserActivity(user, LocalDateTime.now());
        UserParam userParam = getOrCreateUserParam(user);

        if (request.getDescription() != null) {
            user.setDescription(request.getDescription());
        }

        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }

        if (request.getStatus() != null) {
            UserStatus status = UserStatus.fromApiValue(request.getStatus());
            if (status == null) {
                return messageService.buildResponse("user.profile.invalid", null, "Statut invalide");
            }
            user.setStatus(status);
        }

        if (Boolean.TRUE.equals(request.getClearFavoriteShip())) {
            user.setFavoriteShip(null);
        } else if (request.getFavoriteShipId() != null) {
            Ship ship = shipRepository.findById(request.getFavoriteShipId())
                    .orElseThrow(() -> new ResourceNotFoundException("Vaisseau introuvable avec ID: " + request.getFavoriteShipId()));
            user.setFavoriteShip(ship);
        }

        if (request.getNotifGlobal() != null) {
            userParam.setNotifGlobal(request.getNotifGlobal());
        }
        if (request.getNotifEvents() != null) {
            userParam.setNotifEvents(request.getNotifEvents());
        }
        if (request.getNotifFleet() != null) {
            userParam.setNotifFleet(request.getNotifFleet());
        }
        if (request.getNotifGoals() != null) {
            userParam.setNotifGoals(request.getNotifGoals());
        }
        if (request.getNotifDiscord() != null) {
            userParam.setNotifDiscord(request.getNotifDiscord());
        }

        User savedUser = userRepository.save(user);
        userParamRepository.save(userParam);
        return messageService.buildResponse("user.profile.updated", new UserProfileResponseDTO(savedUser, userParam));
    }

    public ResponseEntity<MessageResponse<List<UserOnlineResponseDTO>>> getOnlineUsers() {
        List<User> users = StreamSupport.stream(userRepository.findAll().spliterator(), false)
                .toList();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime absentCutoff = now.minus(ABSENT_THRESHOLD);
        LocalDateTime offlineCutoff = now.minus(OFFLINE_THRESHOLD);
        boolean changed = false;

        for (User user : users) {
            LocalDateTime lastSeen = user.getLastSeenAt();
            if (lastSeen == null) {
                lastSeen = user.getCreatedAt();
            }

            if (lastSeen != null && isAutoStatus(user.getStatus())) {
                if (lastSeen.isBefore(offlineCutoff) && user.getStatus() != UserStatus.HORS_LIGNE) {
                    user.setStatus(UserStatus.HORS_LIGNE);
                    changed = true;
                } else if (lastSeen.isBefore(absentCutoff) && user.getStatus() != UserStatus.ABSENT) {
                    user.setStatus(UserStatus.ABSENT);
                    changed = true;
                }
            }
        }

        if (changed) {
            userRepository.saveAll(users);
        }

        List<UserOnlineResponseDTO> online = users.stream()
                .map(UserOnlineResponseDTO::new)
                .toList();

        return messageService.buildResponse("user.online.list", online);
    }

    public ResponseEntity<MessageResponse<Void>> touchCurrentUserActivity(UUID userId) {
        User user = findUserById(userId);
        LocalDateTime now = LocalDateTime.now();
        if (touchUserActivity(user, now)) {
            userRepository.save(user);
        }
        return messageService.buildResponse("user.activity.updated", null);
    }

    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> updateUserAvatar(UUID userId, MultipartFile file) throws IOException {
        User user = findUserById(userId);
        touchUserActivity(user, LocalDateTime.now());

        String avatarUrl = userAvatarService.storeAvatar(user, file);
        user.setAvatarUrl(avatarUrl);

        User savedUser = userRepository.save(user);
        UserParam userParam = getOrCreateUserParam(savedUser);
        return messageService.buildResponse("user.avatar.updated", new UserProfileResponseDTO(savedUser, userParam));
    }

    private UserParam getOrCreateUserParam(User user) {
        return userParamRepository.findById(user.getId())
                .orElseGet(() -> {
                    UserParam userParam = new UserParam();
                    userParam.setUser(user);
                    return userParamRepository.save(userParam);
                });
    }

    public void forceResetPassword(UUID userId) {
        User user = findUserById(userId);
        String tempPassword = UUID.randomUUID().toString().substring(0, 8);
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setPwdReset(true);
        userRepository.save(user);

        logger.info("Mot de passe temporaire réinitialisé pour {}", user.getUsername());
        userPublisher.sendTemporaryPassword(user.getDiscordId(), tempPassword);
        notificationPushService.sendToUsers(
                List.of(user.getId()),
                "Compte : mot de passe reinitialise",
                "Un mot de passe temporaire a ete genere.",
                "/login",
                3
        );
    }


    @Transactional
    public ResponseEntity<MessageResponse<User>> updateUser(UUID id, String username, String discordId, String roleName) {
        logger.info("Mise à jour de l'utilisateur {}", id);

        User user = findUserById(id);
        List<String> previousRoles = user.getRoles().stream()
                .map(userRole -> userRole.getRole().getName())
                .toList();
        user.setUsername(username);
        user.setDiscordId(discordId);

        Role role = findRoleByName(roleName);

        user.getRoles().clear(); // supprime les anciens (orphanRemoval active ici)

        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);

        user.getRoles().add(userRole); // ajoute proprement

        User saved = userRepository.save(user);
        if (!previousRoles.contains(roleName) || previousRoles.size() != 1) {
            notifyAdmins(
                    "Admin : roles mis a jour",
                    "Roles de " + saved.getUsername() + " : " + roleName,
                    "/icy/admin/members",
                    2
            );
        }
        return messageService.buildResponse("user.updated", saved);
    }

    public List<UUID> getAdminUserIds() {
        return userRepository.findAllByRoleName("ADMIN").stream()
                .map(User::getId)
                .toList();
    }

    private void notifyAdmins(String title, String body, String url, int priority) {
        List<UUID> adminIds = getAdminUserIds();
        if (!adminIds.isEmpty()) {
            notificationPushService.sendToUsers(adminIds, title, body, url, priority);
        }
    }

    private boolean touchUserActivity(User user, LocalDateTime now) {
        boolean changed = false;
        LocalDateTime lastSeen = user.getLastSeenAt();
        if (lastSeen == null || Duration.between(lastSeen, now).compareTo(ACTIVITY_TOUCH_INTERVAL) >= 0) {
            user.setLastSeenAt(now);
            changed = true;
        }

        UserStatus status = user.getStatus();
        if (isAutoStatus(status) && status != UserStatus.CONNECTE) {
            user.setStatus(UserStatus.CONNECTE);
            changed = true;
        }

        return changed;
    }

    private boolean isAutoStatus(UserStatus status) {
        return status == null || (status != UserStatus.INDISPONIBLE && status != UserStatus.EN_JEU);
    }

}






