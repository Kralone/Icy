package com.icy.icy_backend.service.auth;

import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.security.CustomUserDetailsService;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class AuthServiceTest {

    @Test
    void authenticateReturnsTokensWhenPasswordMatches() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);

        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("alice")
                .password("secret")
                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                .build();
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(details);
        when(passwordEncoder.matches("pwd", "secret")).thenReturn(true);

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setPwdReset(false);
        when(userService.getByUsername("alice")).thenReturn(user);

        when(jwtUtil.generateAccessToken(Mockito.eq("alice"), Mockito.any(), Mockito.eq(user.getId())))
                .thenReturn("access");
        when(refreshTokenService.issue(user)).thenReturn("refresh");

        LoginResponseDTO response = authService.authenticate("alice", "pwd");
        assertThat(response.getTokens().get("accessToken")).isEqualTo("access");
        assertThat(response.getTokens().get("refreshToken")).isEqualTo("refresh");
    }

    @Test
    void authenticateReturnsResetTokensWhenPwdReset() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);

        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("alice")
                .password("secret")
                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                .build();
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(details);
        when(passwordEncoder.matches("pwd", "secret")).thenReturn(true);

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setPwdReset(true);
        when(userService.getByUsername("alice")).thenReturn(user);
        when(jwtUtil.generatePasswordResetToken("alice", user.getId())).thenReturn("reset-token");

        LoginResponseDTO response = authService.authenticate("alice", "pwd");
        assertThat(response.getTokens().get("accessToken")).isEqualTo("resetPwd");
        assertThat(response.getTokens().get("refreshToken")).isEqualTo("resetPwd");
        assertThat(response.getPasswordResetToken()).isEqualTo("reset-token");
    }

    @Test
    void authenticateThrowsForInvalidPassword() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);

        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("alice")
                .password("secret")
                .authorities(List.of())
                .build();
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(details);
        when(passwordEncoder.matches("pwd", "secret")).thenReturn(false);

        assertThatThrownBy(() -> authService.authenticate("alice", "pwd"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void refreshAccessTokenValidatesAndBuildsNewTokens() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);

        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("alice")
                .password("secret")
                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                .build();
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(details);

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        when(refreshTokenService.rotate("refresh"))
                .thenReturn(new RefreshTokenService.Rotation(user, "new-refresh"));

        when(jwtUtil.generateAccessToken(Mockito.eq("alice"), Mockito.any(), Mockito.eq(user.getId())))
                .thenReturn("new-access");
        Map<String, String> tokens = authService.refreshAccessToken("refresh");
        assertThat(tokens.get("accessToken")).isEqualTo("new-access");
        assertThat(tokens.get("refreshToken")).isEqualTo("new-refresh");
    }

    @Test
    void completePasswordResetRequiresAValidSingleUseResetToken() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = Mockito.spy(new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        user.setPwdReset(true);

        when(jwtUtil.validatePasswordResetToken("reset-token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("reset-token")).thenReturn(userId);
        when(userService.findUserById(userId)).thenReturn(user);
        when(userService.updatePasswordAndUnlock(userId, "new-password")).thenReturn("alice");
        Mockito.doReturn(new LoginResponseDTO("access", "refresh", null))
                .when(authService).authenticate("alice", "new-password");

        LoginResponseDTO response = authService.completePasswordReset("reset-token", "new-password");

        assertThat(response.getTokens().get("accessToken")).isEqualTo("access");
        verify(refreshTokenService).revokeAllForUser(user);
    }

    @Test
    void completePasswordResetRejectsReplayedToken() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setPwdReset(false);

        when(jwtUtil.validatePasswordResetToken("reset-token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("reset-token")).thenReturn(userId);
        when(userService.findUserById(userId)).thenReturn(user);

        assertThatThrownBy(() -> authService.completePasswordReset("reset-token", "new-password"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void forcePasswordResetRevokesExistingSessions() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        RefreshTokenService refreshTokenService = Mockito.mock(RefreshTokenService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService, refreshTokenService);
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(userService.findUserById(userId)).thenReturn(user);

        authService.forcePasswordReset(userId);

        verify(userService).forceResetPassword(userId);
        verify(refreshTokenService).revokeAllForUser(user);
    }
}
