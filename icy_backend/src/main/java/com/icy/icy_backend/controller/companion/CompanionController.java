package com.icy.icy_backend.controller.companion;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.CustomUserDetailsService;
import com.icy.icy_backend.service.companion.CompanionMembershipService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Points d'accès appelés par le service du compagnon (icy_companion_service) avec son propre jeton
 * (client_credentials, droit {@code iceforge.companion}, voir {@code CompanionAuthServerConfig}).
 * <p>
 * Le service a déjà identifié le membre en vérifiant son jeton ; il demande ici ce que ce membre a le droit de faire.
 * La réponse applique les règles du site comme si le membre faisait la demande lui-même : ses rôles sont relus en
 * base, un compte désactivé est refusé. Réponses sans enveloppe MessageResponse : elles sont lues par un programme.
 */
@RestController
@RequestMapping("/api/companion")
@ConditionalOnProperty(prefix = "icy.companion-auth", name = "enabled", havingValue = "true")
public class CompanionController {
    private final CompanionMembershipService membership;
    private final UserRepository users;
    private final CustomUserDetailsService userDetails;

    public CompanionController(CompanionMembershipService membership, UserRepository users,
                               CustomUserDetailsService userDetails) {
        this.membership = membership;
        this.users = users;
        this.userDetails = userDetails;
    }

    /** 200 : accès du membre à l'opération en direct · 403 pas participant ou compte inactif · 404 opération inconnue. */
    @GetMapping("/operations/{id}/members/{userId}/membership")
    public ResponseEntity<CompanionMembershipDTO> membership(@PathVariable UUID id, @PathVariable UUID userId) {
        return ResponseEntity.ok(asMember(userId, () -> membership.membership(id)));
    }

    /** Exécute la demande avec l'identité du membre, puis rend au fil d'exécution celle du service. */
    private <T> T asMember(UUID userId, Supplier<T> action) {
        User user = users.findById(userId).orElseThrow(() -> new ForbiddenException("Compte IceForge inactif ou introuvable."));
        UserDetails member = userDetails.loadUserByUsername(user.getUsername());
        SecurityContext previous = SecurityContextHolder.getContext();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(member, null, member.getAuthorities()));
        SecurityContextHolder.setContext(context);
        try {
            return action.get();
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }
}
