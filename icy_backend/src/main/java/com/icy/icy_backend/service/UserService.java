package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.Role;
import com.icy.icy_backend.db.repository.UserRepository;
import com.icy.icy_backend.db.repository.RoleRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.rest.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final String DEFAULT_ROLE_NAME = "USER";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final MessageService messageService;

    public UserService(UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder, MessageService messageService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.messageService = messageService;
    }

    /**
     * Récupère un utilisateur via son Discord ID.
     */
    public ResponseEntity<MessageResponse<User>> getUserByDiscordId(Long discordId) {
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
    public ResponseEntity<MessageResponse<User>> createUser(String username, Long discordId) {
        logger.info("Création d'un nouvel utilisateur: {} avec Discord ID: {}", username, discordId);

        if (userRepository.findByDiscordId(discordId).isPresent()) {
            logger.warn("Un utilisateur avec Discord ID {} existe déjà", discordId);

            return messageService.buildResponse("user.createfailed", null,
                    "L'utilisateur avec le Discord ID " + discordId + " existe déjà.");
        }

        User user = new User();
        user.setUsername(username);
        user.setDiscordId(discordId);
        user.setPassword(passwordEncoder.encode("<test>"));

        Role defaultRole = findRoleByName(DEFAULT_ROLE_NAME);
        user.assignDefaultRole(defaultRole);

        User savedUser = userRepository.save(user);
        logger.info("Utilisateur créé avec succès: {}", savedUser.getId());

        return messageService.buildResponse("user.created", savedUser);
    }

    /**
     * Désactive un utilisateur via son ID.
     */
    public ResponseEntity<MessageResponse<Void>> deactivateUser(Long discordId) {
        logger.info("Désactivation de l'utilisateur DiscordId: {}", discordId);
        try {
            User user = findUserByDiscordId(discordId);
            user.setActive(false);
            userRepository.save(user);
            logger.info("Utilisateur désactivé avec succès: {}", discordId);
            return messageService.buildResponse("user.deleted", null);
        } catch (ResourceNotFoundException e) {
            return messageService.buildResponse("user.notfound", null);
        }
    }

    // ====================================================
    // ✅ MÉTHODES UTILITAIRES PRIVÉES
    // ====================================================

    /**
     * Trouve un utilisateur via son ID, ou lève une exception s'il n'existe pas.
     */
    protected User findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> {
                    logger.warn("Utilisateur introuvable avec ID: {}", userId);
                    return new ResourceNotFoundException("Utilisateur introuvable avec ID: " + userId);
                });
    }

    /**
     * Trouve un utilisateur via son Discord ID, ou lève une exception s'il n'existe pas.
     */
    protected User findUserByDiscordId(Long discordId) {
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
}
