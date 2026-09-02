package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.auth.AuthController;
import com.icy.icy_backend.controller.dto.auth.LoginRequest;
import com.icy.icy_backend.controller.dto.auth.ResetPasswordRequest;
import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.controller.support.TestMethodSecurityConfig;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.security.PublicEndpointRateLimiter;
import com.icy.icy_backend.exception.definition.RateLimitExceededException;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.auth.RefreshTokenService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@WebMvcTest(controllers = AuthController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@Import({TestMethodSecurityConfig.class, GlobalExceptionHandler.class})
@SuppressWarnings("removal")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private MessageService messageService;

    @MockitoBean
    private RefreshTokenService refreshTokenService;

    @MockitoBean
    private PublicEndpointRateLimiter rateLimiter;

    @Test
    void authEndpointsReturnOk() throws Exception {
        when(authService.authenticate(eq("user"), eq("pass")))
                .thenReturn(new LoginResponseDTO("access", "refresh", null));
        when(authService.completePasswordReset(eq("reset-token"), eq("new-password")))
                .thenReturn(new LoginResponseDTO("access", "refresh", null));
        when(authService.refreshAccessToken(eq("refresh")))
                .thenReturn(Map.of("accessToken", "new"));
        when(jwtUtil.validateToken(eq("token"))).thenReturn(true);
        when(messageService.buildResponse(eq("user.password.reset"), eq(null)))
                .thenReturn(okResponse(null));
        when(userService.findUserById(any(UUID.class))).thenReturn(new User());

        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("user");
        loginRequest.setPassword("pass");

        ResetPasswordRequest resetRequest = new ResetPasswordRequest();
        resetRequest.setResetToken("reset-token");
        resetRequest.setNewPassword("new-password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/admin/force-reset-password")
                        .with(TestAuth.user(UUID.randomUUID(), "ADMIN"))
                        .param("id", UUID.randomUUID().toString()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", "refresh"))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", "refresh"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/verify-token")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/isAdmin")
                        .with(TestAuth.user(UUID.randomUUID(), "ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void officerCannotForceResetPrivilegedAccount() throws Exception {
        User target = userWithRole("ADMIN");
        when(userService.findUserById(any(UUID.class))).thenReturn(target);

        mockMvc.perform(post("/api/auth/admin/force-reset-password")
                        .with(TestAuth.user(UUID.randomUUID(), "OFFICIER"))
                        .param("id", UUID.randomUUID().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void rateLimitReturnsGeneric429AndRetryAfter() throws Exception {
        doThrow(new RateLimitExceededException(17)).when(rateLimiter).checkRefresh(any());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"must-not-appear\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "17"))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value("Trop de requetes. Reessayez plus tard."));
    }

    @Test
    void failedLoginConsumesFailureQuota() throws Exception {
        when(authService.authenticate("alice", "wrong"))
                .thenThrow(new com.icy.icy_backend.exception.definition.InvalidCredentialsException("Identifiants invalides"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"alice\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());

        verify(rateLimiter).checkLogin(any(), eq("alice"));
        verify(rateLimiter).recordLoginFailure(any(), eq("alice"));
    }

    @Test
    void missingJsonFieldsReturnControlledClientErrors() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/logout")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private static User userWithRole(String roleName) {
        Role role = new Role();
        role.setName(roleName);
        User user = new User();
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        user.setRoles(Set.of(userRole));
        return user;
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




