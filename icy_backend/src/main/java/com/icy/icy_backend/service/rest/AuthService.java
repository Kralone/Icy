package com.icy.icy_backend.service.rest;

import com.icy.icy_backend.controller.dto.response.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.UserResponseDTO;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.CustomUserDetailsService;
import com.icy.icy_backend.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AuthService {
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;

    public AuthService(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService, PasswordEncoder passwordEncoder, UserService userService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
        this.userService = userService;
    }

    public LoginResponseDTO authenticate(String username, String password) {
        logger.info("Tentative d'authentification pour l'utilisateur: {}", username);

        try {
            // Charger les détails utilisateur
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            // Vérification du mot de passe
            if (!passwordEncoder.matches(password, userDetails.getPassword())) {
                logger.warn("Échec d'authentification pour l'utilisateur: {}", username);
                throw new InvalidCredentialsException("Identifiants incorrects !");
            }

            logger.info("Authentification réussie pour l'utilisateur: {}", username);

            // Charger l'utilisateur complet depuis la BDD (avec les rôles)
            User user = userService.getByUsername(username);
            UserResponseDTO userDto = new UserResponseDTO(user);

            // Si l'utilisateur doit réinitialiser son mot de passe
            if (user.getPwdReset()) {
                return new LoginResponseDTO("resetPwd", "resetPwd", userDto);
            }

            // ✅ Génération du JWT avec les rôles
            String accessToken = jwtUtil.generateAccessToken(
                    userDetails.getUsername(),
                    userDetails.getAuthorities(),
                    user.getId()
            );

            String refreshToken = jwtUtil.generateRefreshToken(userDetails.getUsername());

            logger.info("Tokens générés avec succès pour l'utilisateur: {}", username);

            return new LoginResponseDTO(accessToken, refreshToken, userDto);

        } catch (InvalidCredentialsException e) {
            throw e; // garde le message utilisateur
        } catch (Exception e) {
            logger.error("Erreur lors de l'authentification de l'utilisateur: {}", username, e);
            throw new InvalidCredentialsException("Erreur lors de l'authentification.");
        }
    }



    public Map<String, String> refreshAccessToken(String oldRefreshToken) {
        logger.info("Tentative de rafraîchissement du token");

        if (!jwtUtil.validateToken(oldRefreshToken)) {
            logger.warn("Tentative de rafraîchissement avec un token invalide");
            throw new InvalidCredentialsException("Refresh token invalide !");
        }

        String username = jwtUtil.getSubjectFromToken(oldRefreshToken);
        logger.info("Rafraîchissement réussi pour l'utilisateur: {}", username);

        // ⚙️ Récupérer les rôles depuis la BDD (source fiable)
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        User user = userService.getByUsername(username);

        // 🔁 Générer les nouveaux tokens
        String newAccessToken = jwtUtil.generateAccessToken(
                username,
                userDetails.getAuthorities(),
                user.getId()
        );

        String newRefreshToken = jwtUtil.generateRefreshToken(username);

        logger.info("Nouveaux tokens générés avec succès pour l'utilisateur: {}", username);

        return Map.of(
                "accessToken", newAccessToken,
                "refreshToken", newRefreshToken
        );
    }


}
