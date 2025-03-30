package com.icy.icy_backend.security;

import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public class AuthUtils {

    public static UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        if (principal instanceof UserAuthDetails userAuthDetails) {
            return userAuthDetails.getId();
        }

        throw new IllegalStateException("Aucun utilisateur authentifié trouvé dans le contexte.");
    }
}
