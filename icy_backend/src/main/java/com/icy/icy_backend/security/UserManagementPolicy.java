package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.definition.ForbiddenException;

import java.util.Set;

public final class UserManagementPolicy {
    private static final Set<String> PRIVILEGED_ROLES = Set.of("ADMIN", "OFFICIER", "BOT");

    private UserManagementPolicy() {
    }

    public static void assertCanManage(User target, String requestedRole) {
        if (AuthUtils.isAdmin()) {
            return;
        }
        if (requestedRole != null && PRIVILEGED_ROLES.contains(requestedRole)) {
            throw new ForbiddenException("Un officier ne peut pas attribuer un role privilegie.");
        }
        if (target != null && target.getRoles() != null && target.getRoles().stream()
                .anyMatch(userRole -> userRole.getRole() != null
                        && PRIVILEGED_ROLES.contains(userRole.getRole().getName()))) {
            throw new ForbiddenException("Un officier ne peut pas modifier un compte privilegie.");
        }
    }
}
