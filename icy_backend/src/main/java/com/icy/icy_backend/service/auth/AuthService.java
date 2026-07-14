package com.icy.icy_backend.service.auth;

import com.icy.icy_backend.controller.dto.response.auth.LoginResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.CustomUserDetailsService;
import com.icy.icy_backend.service.user.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

@Service
public class AuthService {
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;

    public AuthService(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService, PasswordEncoder passwordEncoder,
                       UserService userService, RefreshTokenService refreshTokenService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
        this.userService = userService;
        this.refreshTokenService = refreshTokenService;
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
                String passwordResetToken = jwtUtil.generatePasswordResetToken(username, user.getId());
                return new LoginResponseDTO("resetPwd", "resetPwd", userDto, passwordResetToken);
            }

            // ✅ Génération du JWT avec les rôles
            String accessToken = jwtUtil.generateAccessToken(
                    userDetails.getUsername(),
                    userDetails.getAuthorities(),
                    user.getId()
            );

            String refreshToken = refreshTokenService.issue(user);

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

        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(oldRefreshToken);
        User user = rotation.user();
        String username = user.getUsername();
        logger.info("Rafraîchissement réussi pour l'utilisateur: {}", username);

        // ⚙️ Récupérer les rôles depuis la BDD (source fiable)
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        // 🔁 Générer les nouveaux tokens
        String newAccessToken = jwtUtil.generateAccessToken(
                username,
                userDetails.getAuthorities(),
                user.getId()
        );

        logger.info("Nouveaux tokens générés avec succès pour l'utilisateur: {}", username);

        return Map.of(
                "accessToken", newAccessToken,
                "refreshToken", rotation.refreshToken()
        );
    }

    @Transactional
    public LoginResponseDTO completePasswordReset(String resetToken, String newPassword) {
        if (newPassword == null || newPassword.length() < 12) {
            throw new BadRequestException("Le mot de passe doit contenir au moins 12 caractères.");
        }
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException("Le mot de passe ne doit pas dépasser 72 octets.");
        }
        if (resetToken == null || !jwtUtil.validatePasswordResetToken(resetToken)) {
            throw new InvalidCredentialsException("Jeton de réinitialisation invalide ou expiré !");
        }

        User user = userService.findUserById(jwtUtil.getUserIdFromToken(resetToken));
        if (!Boolean.TRUE.equals(user.getPwdReset())) {
            throw new InvalidCredentialsException("Cette réinitialisation a déjà été utilisée.");
        }

        String username = userService.updatePasswordAndUnlock(user.getId(), newPassword);
        refreshTokenService.revokeAllForUser(user);
        return authenticate(username, newPassword);
    }

    @Transactional
    public void forcePasswordReset(UUID userId) {
        userService.forceResetPassword(userId);
        refreshTokenService.revokeAllForUser(userService.findUserById(userId));
    }


}






