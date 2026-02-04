package com.icy.icy_backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long accessExpiration;
    private final long refreshExpiration;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.access-expiration}") long accessExpiration,
                   @Value("${jwt.refresh-expiration}") long refreshExpiration) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.accessExpiration = accessExpiration;
        this.refreshExpiration = refreshExpiration;
    }

    // ==============================================================
    // 🔑 Génération des tokens
    // ==============================================================

    public String generateAccessToken(String username, Collection<? extends GrantedAuthority> roles, UUID userId) {
        return Jwts.builder()
                .subject(username)
                .claim("roles", roles.stream()
                        .map(GrantedAuthority::getAuthority)
                        .toList())
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessExpiration))
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(String username) {
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    // ==============================================================
    // ✅ Validation & extraction
    // ==============================================================

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getSubjectFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    public List<String> extractRoles(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Object rolesClaim = claims.get("roles");

            if (rolesClaim == null) {
                return List.of();
            }

            if (rolesClaim instanceof List<?>) {
                // ✅ cas standard
                return ((List<?>) rolesClaim).stream()
                        .map(Object::toString)
                        .toList();
            } else if (rolesClaim instanceof String rolesString) {
                // ✅ fallback si c'est une chaîne JSON
                return List.of(rolesString.replace("[", "")
                                .replace("]", "")
                                .replace("\"", "")
                                .split(","))
                        .stream()
                        .map(String::trim)
                        .toList();
            } else {
                // fallback générique
                return List.of(rolesClaim.toString());
            }
        } catch (Exception e) {
            e.printStackTrace();
            return List.of();
        }
    }

}


