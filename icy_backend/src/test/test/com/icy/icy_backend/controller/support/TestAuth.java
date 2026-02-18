package com.icy.icy_backend.controller.support;

import com.icy.icy_backend.security.UserAuthDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public final class TestAuth {
    private TestAuth() {}

    public static RequestPostProcessor user(UUID id, String... roles) {
        return request -> {
            List<SimpleGrantedAuthority> authorities = Arrays.stream(roles == null ? new String[0] : roles)
                    .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
                    .map(SimpleGrantedAuthority::new)
                    .toList();
            UserAuthDetails details = new UserAuthDetails(id, "user", "password", authorities);
            var auth = new UsernamePasswordAuthenticationToken(details, null, authorities);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            return request;
        };
    }
}
