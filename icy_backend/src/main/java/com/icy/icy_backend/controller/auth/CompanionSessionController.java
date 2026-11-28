package com.icy.icy_backend.controller.auth;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.UserManagementPolicy;
import com.icy.icy_backend.security.companion.CompanionSessionService;
import com.icy.icy_backend.security.companion.CompanionSessionService.CompanionSession;
import com.icy.icy_backend.security.companion.MemberAccessRevocation;
import com.icy.icy_backend.service.user.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Sessions d'Icy Companion vues depuis le site (jeton du site) : le membre voit et coupe les siennes,
 * un officier ou un directeur coupe celles d'un membre qu'il a le droit de gérer.
 */
@RestController
@RequestMapping("/api/auth/companion")
public class CompanionSessionController {
    private final CompanionSessionService sessions;
    private final UserService users;

    public CompanionSessionController(CompanionSessionService sessions, UserService users) {
        this.sessions = sessions;
        this.users = users;
    }

    @GetMapping("/sessions")
    public List<CompanionSession> mySessions() {
        return sessions.sessionsOf(users.findUserById(AuthUtils.getCurrentUserId()));
    }

    /** Déconnecte un appareil : le sien, ou celui d'un membre géré (officier, directeur). */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(@PathVariable String sessionId) {
        String ownerName = sessions.ownerOf(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session introuvable"));
        User owner = users.getByUsername(ownerName);
        if (!owner.getId().equals(AuthUtils.getCurrentUserId())) {
            if (!AuthUtils.isAdmin() && !AuthUtils.hasRole("OFFICIER")) {
                throw new ResourceNotFoundException("Session introuvable");
            }
            UserManagementPolicy.assertCanManage(owner, null);
        }
        sessions.revokeSession(owner, sessionId);
        return ResponseEntity.noContent().build();
    }

    /** Coupe tout accès d'un membre au compagnon, tout de suite (sessions et jetons en cours). */
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/members/{userId}/sessions")
    public ResponseEntity<Void> revokeMember(@PathVariable UUID userId) {
        User target = users.findUserByIdIncludingInactive(userId);
        UserManagementPolicy.assertCanManage(target, null);
        sessions.revokeAll(target, MemberAccessRevocation.REVOKED);
        return ResponseEntity.noContent().build();
    }
}
