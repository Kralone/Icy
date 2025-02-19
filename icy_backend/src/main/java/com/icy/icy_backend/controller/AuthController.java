package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.LoginRequest;
import com.icy.icy_backend.service.rest.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginRequest request) {
        logger.info("Requête de login reçue pour : {}", request.getUsername());
        Map<String, String> tokens = authService.authenticate(request.getUsername(), request.getPassword());
        logger.info("Login réussi, retour des tokens.");
        return ResponseEntity.ok(tokens);
    }


    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(HttpServletRequest request, HttpServletResponse response) {
        logger.debug("Requête reçue : tentative de rafraîchissement du token");

        // Récupérer le refreshToken depuis le cookie
        Optional<String> refreshTokenOpt = Arrays.stream(request.getCookies())
                .filter(cookie -> "refreshToken".equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();

        if (refreshTokenOpt.isEmpty()) {
            logger.warn("Requête rejetée : refresh token manquant ou invalide");
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "message", "Refresh token manquant ou invalide"));
        }

        logger.debug("Refresh token trouvé, tentative de génération d'un nouvel access token");
        ResponseEntity<Map<String, String>> responseEntity = ResponseEntity.ok(authService.refreshAccessToken(refreshTokenOpt.get(), response));
        logger.debug("Réponse envoyée : nouvel access token généré avec succès");

        return responseEntity;
    }
}
