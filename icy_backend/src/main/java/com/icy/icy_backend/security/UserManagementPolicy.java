package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.definition.ForbiddenException;

public final class UserManagementPolicy {
    private UserManagementPolicy() {
    }

    public static void assertCanManage(User target, String requestedRole) {
        if (AuthUtils.isAdmin()) {
            return;
        }
        if (requestedRole != null && !"USER".equals(requestedRole)) {
            throw new ForbiddenException("Un officier ne peut attribuer qu'un role utilisateur.");
        }
        if (target != null && target.getRoles() != null && target.getRoles().stream()
                .anyMatch(userRole -> userRole.getRole() != null
                        && !"USER".equals(userRole.getRole().getName()))) {
            throw new ForbiddenException("Un officier ne peut pas modifier un compte privilegie.");
        }
    }
}
