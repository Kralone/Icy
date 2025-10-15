package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.service.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, @Lazy UserService userService) {
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        if (!jwtUtil.validateToken(token)) {
            logger.warn("❌ Token JWT invalide ou expiré");
            filterChain.doFilter(request, response);
            return;
        }

        String username = jwtUtil.getSubjectFromToken(token);
        List<String> roles = jwtUtil.extractRoles(token);

        if (username == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // ⚙️ Si un utilisateur est déjà authentifié, ne pas écraser
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // ✅ Récupère l'utilisateur complet pour obtenir son ID
            User user = userService.getByUsername(username);
            UUID userId = user.getId();

            // Conversion des rôles en autorités Spring
            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());

            // ✅ Crée notre UserAuthDetails personnalisé
            UserAuthDetails userAuthDetails = new UserAuthDetails(
                    userId,
                    username,
                    user.getPassword(),
                    authorities
            );

            // ✅ Crée et injecte le token d’authentification complet
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userAuthDetails, null, authorities);

            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authentication);

            logger.info("✅ Authentification injectée dans le contexte : {} avec rôles {}", username, roles);

        } catch (Exception e) {
            logger.error("⚠️ Erreur lors de l’injection de l’utilisateur {} dans le contexte : {}", username, e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
