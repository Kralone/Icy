package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.auth.AuthController;
import com.icy.icy_backend.controller.dto.auth.LoginRequest;
import com.icy.icy_backend.controller.dto.auth.ResetPasswordRequest;
import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.auth.RefreshTokenService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private MessageService messageService;

    @MockBean
    private RefreshTokenService refreshTokenService;

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

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




