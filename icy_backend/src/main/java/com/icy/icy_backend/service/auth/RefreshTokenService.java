package com.icy.icy_backend.service.auth;

import com.icy.icy_backend.db.entity.auth.RefreshToken;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.auth.RefreshTokenRepository;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.security.JwtUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class RefreshTokenService {
    private final RefreshTokenRepository repository;
    private final JwtUtil jwtUtil;

    public RefreshTokenService(RefreshTokenRepository repository, JwtUtil jwtUtil) {
        this.repository = repository;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public String issue(User user) {
        return createToken(user);
    }

    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public Rotation rotate(String rawToken) {
        if (rawToken == null || !jwtUtil.validateRefreshToken(rawToken)) {
            throw invalidToken();
        }

        RefreshToken stored = repository.findByTokenHashForUpdate(hash(rawToken))
                .orElseThrow(this::invalidToken);
        Instant now = Instant.now();

        if (stored.getRevokedAt() != null) {
            repository.revokeAllActiveForUser(stored.getUser().getId(), now);
            throw new InvalidCredentialsException("Refresh token déjà utilisé !");
        }
        if (!stored.getExpiresAt().isAfter(now)) {
            stored.setRevokedAt(now);
            repository.save(stored);
            throw invalidToken();
        }
        if (!stored.getUser().getId().equals(jwtUtil.getUserIdFromToken(rawToken))
                || !stored.getUser().getUsername().equals(jwtUtil.getSubjectFromToken(rawToken))) {
            stored.setRevokedAt(now);
            repository.save(stored);
            throw invalidToken();
        }

        String replacement = createToken(stored.getUser());
        stored.setRevokedAt(now);
        stored.setReplacedByTokenHash(hash(replacement));
        repository.save(stored);
        return new Rotation(stored.getUser(), replacement);
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || !jwtUtil.validateRefreshToken(rawToken)) {
            return;
        }
        repository.findByTokenHashForUpdate(hash(rawToken)).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(Instant.now());
                repository.save(token);
            }
        });
    }

    @Transactional
    public void revokeAllForUser(User user) {
        repository.revokeAllActiveForUser(user.getId(), Instant.now());
    }

    private String createToken(User user) {
        String rawToken = jwtUtil.generateRefreshToken(user.getUsername(), user.getId());
        RefreshToken stored = new RefreshToken();
        stored.setUser(user);
        stored.setTokenHash(hash(rawToken));
        stored.setExpiresAt(jwtUtil.getExpirationFromToken(rawToken).toInstant());
        repository.save(stored);
        return rawToken;
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponible", exception);
        }
    }

    private InvalidCredentialsException invalidToken() {
        return new InvalidCredentialsException("Refresh token invalide !");
    }

    public record Rotation(User user, String refreshToken) {
    }
}
