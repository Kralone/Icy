package com.icy.icy_backend.db.repository.auth;

import com.icy.icy_backend.db.entity.auth.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT token FROM RefreshToken token JOIN FETCH token.user WHERE token.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE RefreshToken token SET token.revokedAt = :revokedAt " +
            "WHERE token.user.id = :userId AND token.revokedAt IS NULL")
    int revokeAllActiveForUser(@Param("userId") UUID userId, @Param("revokedAt") Instant revokedAt);
}
