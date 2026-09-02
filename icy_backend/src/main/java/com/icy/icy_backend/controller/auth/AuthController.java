package com.icy.icy_backend.controller.auth;

import com.icy.icy_backend.controller.dto.auth.LoginRequest;
import com.icy.icy_backend.controller.dto.auth.ResetPasswordRequest;
import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.UserManagementPolicy;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.PublicEndpointRateLimiter;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.auth.RefreshTokenService;
import com.icy.icy_backend.service.common.MessageService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final MessageService messageService;
    private final RefreshTokenService refreshTokenService;
    private final PublicEndpointRateLimiter rateLimiter;

    public AuthController(AuthService authService, UserService userService, JwtUtil jwtUtil,
                          MessageService messageService, RefreshTokenService refreshTokenService,
                          PublicEndpointRateLimiter rateLimiter) {
        this.authService = authService;
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.messageService = messageService;
        this.refreshTokenService = refreshTokenService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        rateLimiter.checkLogin(httpRequest, request == null ? null : request.getUsername());
        if (request == null || isBlank(request.getUsername()) || isBlank(request.getPassword())) {
            throw new BadRequestException("Identifiant et mot de passe requis");
        }
        logger.info("Requete de login recue.");
        try {
            LoginResponseDTO tokens = authService.authenticate(request.getUsername(), request.getPassword());
            logger.info("Login reussi, retour des tokens.");
            return ResponseEntity.ok(tokens);
        } catch (InvalidCredentialsException ex) {
            rateLimiter.recordLoginFailure(httpRequest, request == null ? null : request.getUsername());
            throw ex;
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<LoginResponseDTO> resetPassword(@RequestBody ResetPasswordRequest request,
                                                           HttpServletRequest httpRequest) {
        rateLimiter.checkPasswordReset(httpRequest);
        if (request == null || isBlank(request.getResetToken()) || isBlank(request.getNewPassword())) {
            throw new BadRequestException("Jeton et nouveau mot de passe requis");
        }
        return ResponseEntity.ok(authService.completePasswordReset(request.getResetToken(), request.getNewPassword()));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/admin/force-reset-password")
    public ResponseEntity<MessageResponse<Void>> forceResetPassword(@RequestParam UUID id) {
        UserManagementPolicy.assertCanManage(userService.findUserById(id), null);
        authService.forcePasswordReset(id);
        return messageService.buildResponse("user.password.reset", null);
    }


    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(@RequestBody Map<String, String> body,
                                                        HttpServletRequest httpRequest) {
        rateLimiter.checkRefresh(httpRequest);
        if (body == null) {
            throw new BadRequestException("Corps de requete manquant");
        }
        String refreshToken = body.get("refreshToken");

        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "message", "Refresh token manquant ou invalide"));
        }

        return ResponseEntity.ok(authService.refreshAccessToken(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
        if (body == null || isBlank(body.get("refreshToken"))) {
            throw new BadRequestException("Refresh token requis");
        }
        refreshTokenService.revoke(body.get("refreshToken"));
        return ResponseEntity.noContent().build();
    }



    @GetMapping("/verify-token")
    public ResponseEntity<Void> verifyToken(@RequestHeader("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).build();
        }

        String token = authHeader.substring(7); // remove "Bearer "

        if (!jwtUtil.validateToken(token)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.status(200).build();
    }

    @GetMapping("/isAdmin")
    public ResponseEntity<Boolean> getAuthenticatedUser() {
        return ResponseEntity.ok(AuthUtils.isAdmin());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

}




