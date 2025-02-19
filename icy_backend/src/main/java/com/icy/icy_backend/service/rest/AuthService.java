package com.icy.icy_backend.service.rest;

import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.CustomUserDetailsService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AuthService {
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
    }

    public Map<String, String> authenticate(String username, String password) {
        logger.info("Tentative d'authentification pour l'utilisateur: {}", username);
        logger.debug(passwordEncoder.encode("test"));
        try {
            // Authentification manuelle
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (!passwordEncoder.matches(password, userDetails.getPassword())) {
                logger.warn("Échec d'authentification pour l'utilisateur: {}", username);
                throw new InvalidCredentialsException("Identifiants incorrects !");
            }
            logger.info("Authentification réussie pour l'utilisateur: {}", username);

            // Générer accessToken et refreshToken
            String accessToken = jwtUtil.generateAccessToken(username);
            String refreshToken = jwtUtil.generateRefreshToken(username);

            logger.info("Tokens générés avec succès pour l'utilisateur: {}", username);
            return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
        } catch (Exception e) {
            logger.error("Erreur lors de l'authentification de l'utilisateur: {}", username, e);
            throw new InvalidCredentialsException("Erreur lors de l'authentification.");
        }
    }


    public Map<String, String> refreshAccessToken(String oldRefreshToken, HttpServletResponse response) {
        logger.info("Tentative de rafraîchissement du token");
        if (!jwtUtil.validateToken(oldRefreshToken)) {
            logger.warn("Tentative de rafraîchissement avec un token invalide");
            throw new InvalidCredentialsException("Refresh token invalide !");
        }

        // Extraire l'utilisateur depuis le refresh token
        String username = jwtUtil.getSubjectFromToken(oldRefreshToken);
        logger.info("Rafraîchissement réussi pour l'utilisateur: {}", username);

        // Générer un NOUVEAU refresh token
        String newRefreshToken = jwtUtil.generateRefreshToken(username);
        String newAccessToken = jwtUtil.generateAccessToken(username);

        // Mettre à jour le cookie avec le NOUVEAU refresh token
        Cookie refreshCookie = new Cookie("refreshToken", newRefreshToken);
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(true);
        refreshCookie.setPath("/api/auth/refresh");
        refreshCookie.setMaxAge(7 * 24 * 60 * 60); // Expiration 7 jours

        response.addCookie(refreshCookie);
        response.addHeader("Set-Cookie", "refreshToken=" + newRefreshToken + "; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=" + (7 * 24 * 60 * 60));

        logger.info("Nouveau refresh token généré et stocké pour l'utilisateur: {}", username);
        return Map.of("accessToken", newAccessToken);
    }
}
