package com.icy.icy_backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    @Test
    void generateAndValidateTokenRoundTrip() {
        JwtUtil jwtUtil = new JwtUtil(
                "01234567890123456789012345678901",
                60_000,
                120_000
        );

        String token = jwtUtil.generateAccessToken(
                "alice",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")),
                UUID.randomUUID()
        );

        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.validateRefreshToken(token)).isFalse();
        assertThat(jwtUtil.validatePasswordResetToken(token)).isFalse();
        assertThat(jwtUtil.getSubjectFromToken(token)).isEqualTo("alice");
        assertThat(jwtUtil.extractRoles(token)).contains("ROLE_ADMIN");
    }

    @Test
    void tokenTypesCannotBeUsedInterchangeably() {
        JwtUtil jwtUtil = new JwtUtil(
                "01234567890123456789012345678901",
                60_000,
                120_000
        );
        UUID userId = UUID.randomUUID();

        String refreshToken = jwtUtil.generateRefreshToken("alice");
        String resetToken = jwtUtil.generatePasswordResetToken("alice", userId);

        assertThat(jwtUtil.validateRefreshToken(refreshToken)).isTrue();
        assertThat(jwtUtil.validateToken(refreshToken)).isFalse();
        assertThat(jwtUtil.validatePasswordResetToken(resetToken)).isTrue();
        assertThat(jwtUtil.validateToken(resetToken)).isFalse();
        assertThat(jwtUtil.getUserIdFromToken(resetToken)).isEqualTo(userId);
    }

    @Test
    void invalidTokenReturnsFalse() {
        JwtUtil jwtUtil = new JwtUtil(
                "01234567890123456789012345678901",
                60_000,
                120_000
        );

        assertThat(jwtUtil.validateToken("not-a-jwt")).isFalse();
    }
}
