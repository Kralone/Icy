package com.icy.icy_backend.service.auth;

import com.icy.icy_backend.db.entity.auth.RefreshToken;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.auth.RefreshTokenRepository;
import com.icy.icy_backend.exception.definition.InvalidCredentialsException;
import com.icy.icy_backend.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefreshTokenServiceTest {

    @Test
    void issueStoresOnlyTheTokenHash() {
        RefreshTokenRepository repository = Mockito.mock(RefreshTokenRepository.class);
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        RefreshTokenService service = new RefreshTokenService(repository, jwtUtil);
        User user = user();
        Instant expiration = Instant.now().plusSeconds(3600);

        when(jwtUtil.generateRefreshToken("alice", user.getId())).thenReturn("raw-refresh-token");
        when(jwtUtil.getExpirationFromToken("raw-refresh-token")).thenReturn(Date.from(expiration));

        assertThat(service.issue(user)).isEqualTo("raw-refresh-token");

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getTokenHash())
                .hasSize(64)
                .doesNotContain("raw-refresh-token");
        assertThat(captor.getValue().getExpiresAt()).isEqualTo(Date.from(expiration).toInstant());
    }

    @Test
    void rotateRevokesTheOldTokenAndReturnsAReplacement() {
        RefreshTokenRepository repository = Mockito.mock(RefreshTokenRepository.class);
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        RefreshTokenService service = new RefreshTokenService(repository, jwtUtil);
        User user = user();
        RefreshToken stored = storedToken(user);

        when(jwtUtil.validateRefreshToken("old-token")).thenReturn(true);
        when(repository.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));
        when(jwtUtil.getUserIdFromToken("old-token")).thenReturn(user.getId());
        when(jwtUtil.getSubjectFromToken("old-token")).thenReturn("alice");
        when(jwtUtil.generateRefreshToken("alice", user.getId())).thenReturn("new-token");
        when(jwtUtil.getExpirationFromToken("new-token"))
                .thenReturn(Date.from(Instant.now().plusSeconds(7200)));

        RefreshTokenService.Rotation rotation = service.rotate("old-token");

        assertThat(rotation.user()).isSameAs(user);
        assertThat(rotation.refreshToken()).isEqualTo("new-token");
        assertThat(stored.getRevokedAt()).isNotNull();
        assertThat(stored.getReplacedByTokenHash()).hasSize(64);
        verify(repository, Mockito.times(2)).save(any(RefreshToken.class));
    }

    @Test
    void replayRevokesEveryActiveTokenForTheUser() {
        RefreshTokenRepository repository = Mockito.mock(RefreshTokenRepository.class);
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        RefreshTokenService service = new RefreshTokenService(repository, jwtUtil);
        User user = user();
        RefreshToken stored = storedToken(user);
        stored.setRevokedAt(Instant.now().minusSeconds(1));

        when(jwtUtil.validateRefreshToken("replayed-token")).thenReturn(true);
        when(repository.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.rotate("replayed-token"))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(repository).revokeAllActiveForUser(Mockito.eq(user.getId()), any(Instant.class));
    }

    private static User user() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        return user;
    }

    private static RefreshToken storedToken(User user) {
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash("0".repeat(64));
        token.setExpiresAt(Instant.now().plusSeconds(3600));
        return token;
    }
}
