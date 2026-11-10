package com.icy.icy_backend.service.bank;

import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Droits sur la banque de guilde, toujours vérifiés côté serveur.
 * Tout membre voit le solde et les projets. Le détail (qui a donné quoi) est réservé aux admins, officiers,
 * spécialistes et trésoriers ; la saisie aux admins, officiers et trésoriers.
 * Les rôles sont relus en base : une fonction de trésorier donnée ou retirée compte tout de suite, sans attendre un nouveau jeton.
 */
@Component
@RequiredArgsConstructor
public class BankAccess {
    public static final String TREASURER = "TRESORIER";
    static final Set<String> DETAIL_ROLES = Set.of("ADMIN", "OFFICIER", "SPECIALISTE", TREASURER);
    static final Set<String> WRITE_ROLES = Set.of("ADMIN", "OFFICIER", TREASURER);

    private final UserRoleRepository userRoles;

    public UUID currentUserId() {
        return AuthUtils.getCurrentUserId();
    }

    public Set<String> currentRoles() {
        return userRoles.findByUserId(currentUserId()).stream()
                .map(UserRole::getRole)
                .filter(role -> role != null && role.getName() != null)
                .map(role -> role.getName().trim().toUpperCase())
                .collect(Collectors.toSet());
    }

    public boolean canViewDetails(Set<String> roles) {
        return roles.stream().anyMatch(DETAIL_ROLES::contains);
    }

    public boolean canWrite(Set<String> roles) {
        return roles.stream().anyMatch(WRITE_ROLES::contains);
    }

    public void requireDetails() {
        if (!canViewDetails(currentRoles())) {
            throw new ForbiddenException("Le détail de la banque est réservé aux trésoriers, spécialistes, officiers et administrateurs.");
        }
    }

    public void requireWrite() {
        if (!canWrite(currentRoles())) {
            throw new ForbiddenException("Seuls les trésoriers, officiers et administrateurs saisissent dans la banque.");
        }
    }
}
