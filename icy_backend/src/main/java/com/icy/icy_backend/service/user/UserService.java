package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.RoleRepository;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
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
import java.util.stream.StreamSupport;

@Service
public class UserService {
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final String DEFAULT_ROLE_NAME = "USER";

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final MessageService messageService;
    private final UserPublisher userPublisher;
    private final NotificationPushService notificationPushService;

    public UserService(UserRepository userRepository, UserRoleRepository userRoleRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder, MessageService messageService, UserPublisher userPublisher, NotificationPushService notificationPushService) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.messageService = messageService;
        this.userPublisher = userPublisher;
        this.notificationPushService = notificationPushService;
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

        Role defaultRole = findRoleByName(role);
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
        } else if (identifier instanceof String discordId) {
            return findUserByDiscordId(discordId);
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

        // Supprimer proprement les anciennes relations UserRole
        userRoleRepository.deleteAllByUserId(user.getId());
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

}






