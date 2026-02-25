package com.icy.icy_backend.controller.auth;

import com.icy.icy_backend.controller.dto.auth.LoginRequest;
import com.icy.icy_backend.controller.dto.auth.ResetPasswordRequest;
import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.common.MessageService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    public AuthController(AuthService authService, UserService userService, JwtUtil jwtUtil, MessageService messageService) {
        this.authService = authService;
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.messageService = messageService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@RequestBody LoginRequest request) {
        logger.info("Requête de login reçue pour : {}", request.getUsername());
        LoginResponseDTO tokens = authService.authenticate(request.getUsername(), request.getPassword());
        logger.info("Login réussi, retour des tokens.");
        return ResponseEntity.ok(tokens);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<LoginResponseDTO> resetPassword(@RequestBody ResetPasswordRequest request) {
        String username = userService.updatePasswordAndUnlock(request.getId(), request.getNewPassword());
        LoginResponseDTO loginResponse = authService.authenticate(username, request.getNewPassword());
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/admin/force-reset-password")
    public ResponseEntity<MessageResponse<Void>> forceResetPassword(@RequestParam UUID id) {
        userService.forceResetPassword(id);
        return messageService.buildResponse("user.password.reset", null);
    }


    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");

        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "message", "Refresh token manquant ou invalide"));
        }

        return ResponseEntity.ok(authService.refreshAccessToken(refreshToken));
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

}




