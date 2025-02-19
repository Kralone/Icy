package com.icy.icy_backend.security;

import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends GenericFilterBean {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Value("${bot.api-key}") // ✅ Injecte la clé API depuis application.yml
    private String botApiKey;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String authHeader = httpRequest.getHeader("Authorization");

        try {
            if (authHeader != null && authHeader.equals("Bot " + botApiKey)) {
                logger.debug("Authentification du bot réussie");
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken("bot", null, Collections.emptyList())
                );
                chain.doFilter(request, response);
                return;
            }

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                String username = jwtUtil.getSubjectFromToken(token);

                if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    User userDetails = (User) userDetailsService.loadUserByUsername(username);

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(httpRequest));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (ExpiredJwtException e) {
            logger.warn("Jeton JWT expiré : " + e.getMessage());
            httpResponse.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Le jeton JWT a expiré.");
            return; // Ne pas laisser la requête passer
        } catch (Exception e) {
            logger.error("Erreur lors de l'authentification JWT : " + e.getMessage());
            httpResponse.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Erreur d'authentification.");
            return;
        }

        chain.doFilter(request, response);
    }
}