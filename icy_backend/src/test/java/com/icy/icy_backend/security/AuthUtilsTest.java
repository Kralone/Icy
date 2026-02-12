package com.icy.icy_backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthUtilsTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getCurrentUserIdReadsFromSecurityContext() {
        UUID id = UUID.randomUUID();
        UserAuthDetails details = new UserAuthDetails(
                id,
                "alice",
                "secret",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        var auth = new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThat(AuthUtils.getCurrentUserId()).isEqualTo(id);
    }

    @Test
    void getCurrentUserIdThrowsWithoutPrincipal() {
        var auth = new UsernamePasswordAuthenticationToken("user", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(AuthUtils::getCurrentUserId)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void isAdminChecksAuthorities() {
        UserAuthDetails details = new UserAuthDetails(
                UUID.randomUUID(),
                "admin",
                "secret",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        var auth = new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThat(AuthUtils.isAdmin()).isTrue();
        SecurityContextHolder.clearContext();
        assertThat(AuthUtils.isAdmin()).isFalse();
    }
}
