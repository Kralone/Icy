package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.Role;
import com.icy.icy_backend.db.entity.UserRole;
import com.icy.icy_backend.db.repository.UserRepository;
import com.icy.icy_backend.db.repository.RoleRepository;
import com.icy.icy_backend.db.repository.UserRoleRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.rest.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class UserRoleService {
    private static final Logger logger = LoggerFactory.getLogger(UserRoleService.class);
    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final MessageService messageService;

    public UserRoleService(UserRoleRepository userRoleRepository, UserRepository userRepository, RoleRepository roleRepository, MessageService messageService) {
        this.userRoleRepository = userRoleRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<UserRole>>> getRolesByUserId(UUID userId) {
        logger.info("Récupération des rôles pour l'utilisateur ID: {}", userId);
        List<UserRole> roles = userRoleRepository.findByUserId(userId);
        if (roles.isEmpty()) {
            logger.warn("Aucun rôle trouvé pour l'utilisateur ID: {}", userId);
            return messageService.buildResponse("user.notfound", List.of(), "Aucun rôle trouvé pour l'utilisateur ID: " + userId);
        }
        logger.info("Nombre de rôles trouvés: {}", roles.size());
        return messageService.buildResponse("user.found", roles);
    }

    public ResponseEntity<MessageResponse<Void>> assignRoleToUser(UUID userId, UUID roleId) {
        logger.info("Assignation d'un rôle à l'utilisateur ID: {} avec le rôle ID: {}", userId, roleId);
        User user = userRepository.findById(userId).orElseThrow(() -> {
            logger.warn("Utilisateur non trouvé avec ID: {}", userId);
            return new ResourceNotFoundException("Utilisateur non trouvé avec l'ID: " + userId);
        });
        Role role = roleRepository.findById(roleId).orElseThrow(() -> {
            logger.warn("Rôle non trouvé avec ID: {}", roleId);
            return new ResourceNotFoundException("Rôle non trouvé avec l'ID: " + roleId);
        });

        if (userRoleRepository.findByUserId(userId).stream().anyMatch(ur -> ur.getRole().equals(role))) {
            logger.warn("L'utilisateur ID: {} possède déjà le rôle ID: {}", userId, roleId);
            return messageService.buildResponse("user.createfailed", null);
        }

        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        userRoleRepository.save(userRole);
        logger.info("Rôle assigné avec succès à l'utilisateur ID: {}", userId);
        return messageService.buildResponse("user.created", null);
    }
}
