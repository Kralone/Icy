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

class AuthServiceTest {

    @Test
    void authenticateReturnsTokensWhenPasswordMatches() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService);

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
        when(jwtUtil.generateRefreshToken("alice")).thenReturn("refresh");

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
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService);

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

        LoginResponseDTO response = authService.authenticate("alice", "pwd");
        assertThat(response.getTokens().get("accessToken")).isEqualTo("resetPwd");
        assertThat(response.getTokens().get("refreshToken")).isEqualTo("resetPwd");
    }

    @Test
    void authenticateThrowsForInvalidPassword() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        CustomUserDetailsService userDetailsService = Mockito.mock(CustomUserDetailsService.class);
        PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService);

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
        AuthService authService = new AuthService(jwtUtil, userDetailsService, passwordEncoder, userService);

        when(jwtUtil.validateToken("refresh")).thenReturn(true);
        when(jwtUtil.getSubjectFromToken("refresh")).thenReturn("alice");

        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("alice")
                .password("secret")
                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                .build();
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(details);

        User user = new User();
        user.setId(UUID.randomUUID());
        when(userService.getByUsername("alice")).thenReturn(user);

        when(jwtUtil.generateAccessToken(Mockito.eq("alice"), Mockito.any(), Mockito.eq(user.getId())))
                .thenReturn("new-access");
        when(jwtUtil.generateRefreshToken("alice")).thenReturn("new-refresh");

        Map<String, String> tokens = authService.refreshAccessToken("refresh");
        assertThat(tokens.get("accessToken")).isEqualTo("new-access");
        assertThat(tokens.get("refreshToken")).isEqualTo("new-refresh");
    }
}
