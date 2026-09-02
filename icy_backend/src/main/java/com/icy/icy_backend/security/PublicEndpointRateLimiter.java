package com.icy.icy_backend.security;

import com.icy.icy_backend.exception.definition.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class PublicEndpointRateLimiter {
    private final ClientAddressResolver addressResolver;
    private final Clock clock;
    private final byte[] salt;
    private final int maximumEntries;
    private final Map<String, Window> windows;
    private final Limit loginIp;
    private final Limit loginIdentityIp;
    private final Limit refresh;
    private final Limit passwordReset;
    private final Limit recruitment;

    @Autowired
    public PublicEndpointRateLimiter(
            ClientAddressResolver addressResolver,
            @Value("${icy.rate-limit.maximum-entries:20000}") int maximumEntries,
            @Value("${icy.rate-limit.login.ip-attempts:20}") int loginIpAttempts,
            @Value("${icy.rate-limit.login.identity-attempts:10}") int loginIdentityAttempts,
            @Value("${icy.rate-limit.login.window-seconds:300}") long loginWindowSeconds,
            @Value("${icy.rate-limit.refresh.attempts:60}") int refreshAttempts,
            @Value("${icy.rate-limit.refresh.window-seconds:300}") long refreshWindowSeconds,
            @Value("${icy.rate-limit.reset-password.attempts:10}") int resetAttempts,
            @Value("${icy.rate-limit.reset-password.window-seconds:900}") long resetWindowSeconds,
            @Value("${icy.rate-limit.recruitment.attempts:5}") int recruitmentAttempts,
            @Value("${icy.rate-limit.recruitment.window-seconds:3600}") long recruitmentWindowSeconds
    ) {
        this(addressResolver, Clock.systemUTC(), randomSalt(), maximumEntries,
                new Limit(loginIpAttempts, Duration.ofSeconds(loginWindowSeconds)),
                new Limit(loginIdentityAttempts, Duration.ofSeconds(loginWindowSeconds)),
                new Limit(refreshAttempts, Duration.ofSeconds(refreshWindowSeconds)),
                new Limit(resetAttempts, Duration.ofSeconds(resetWindowSeconds)),
                new Limit(recruitmentAttempts, Duration.ofSeconds(recruitmentWindowSeconds)));
    }

    PublicEndpointRateLimiter(ClientAddressResolver addressResolver, Clock clock, byte[] salt,
                              int maximumEntries, Limit loginIp, Limit loginIdentityIp,
                              Limit refresh, Limit passwordReset, Limit recruitment) {
        if (maximumEntries < 100) {
            throw new IllegalArgumentException("Le rate limiter doit accepter au moins 100 entrees.");
        }
        this.addressResolver = addressResolver;
        this.clock = clock;
        this.salt = salt.clone();
        this.maximumEntries = maximumEntries;
        this.loginIp = loginIp.validated();
        this.loginIdentityIp = loginIdentityIp.validated();
        this.refresh = refresh.validated();
        this.passwordReset = passwordReset.validated();
        this.recruitment = recruitment.validated();
        this.windows = new LinkedHashMap<>(128, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
                return size() > PublicEndpointRateLimiter.this.maximumEntries;
            }
        };
    }

    public void checkLogin(HttpServletRequest request, String username) {
        String address = addressResolver.resolve(request);
        enforce("login:ip", address, loginIp);
        enforce("login:identity-ip", normalizedIdentity(username) + "\u0000" + address, loginIdentityIp);
    }

    public synchronized void recordLoginFailure(HttpServletRequest request, String username) {
        String address = addressResolver.resolve(request);
        // Authentication happens between checkLogin and this method. Re-check both
        // windows while holding one lock so concurrent failures cannot all be recorded
        // beyond the quota and still return a normal authentication failure.
        enforce("login:ip", address, loginIp);
        enforce("login:identity-ip", normalizedIdentity(username) + "\u0000" + address, loginIdentityIp);
        consume("login:ip", address, loginIp);
        consume("login:identity-ip", normalizedIdentity(username) + "\u0000" + address, loginIdentityIp);
    }

    public void checkRefresh(HttpServletRequest request) {
        enforceAndConsume("refresh:ip", addressResolver.resolve(request), refresh);
    }

    public void checkPasswordReset(HttpServletRequest request) {
        enforceAndConsume("reset:ip", addressResolver.resolve(request), passwordReset);
    }

    public void checkRecruitment(HttpServletRequest request) {
        enforceAndConsume("recruitment:ip", addressResolver.resolve(request), recruitment);
    }

    private synchronized void enforceAndConsume(String namespace, String discriminator, Limit limit) {
        enforce(namespace, discriminator, limit);
        consume(namespace, discriminator, limit);
    }

    private synchronized void enforce(String namespace, String discriminator, Limit limit) {
        long now = clock.millis();
        String key = fingerprint(namespace + "\u0000" + discriminator);
        Window current = windows.get(key);
        if (current == null || now >= current.endsAtMillis()) {
            return;
        }
        if (current.count() >= limit.attempts()) {
            long retryAfter = Math.max(1, (current.endsAtMillis() - now + 999) / 1000);
            throw new RateLimitExceededException(retryAfter);
        }
    }

    private synchronized void consume(String namespace, String discriminator, Limit limit) {
        long now = clock.millis();
        String key = fingerprint(namespace + "\u0000" + discriminator);
        Window current = windows.get(key);
        if (current == null || now >= current.endsAtMillis()) {
            windows.put(key, new Window(1, saturatedAdd(now, limit.window().toMillis())));
            return;
        }
        windows.put(key, new Window(Math.min(Integer.MAX_VALUE, current.count() + 1), current.endsAtMillis()));
    }

    private static String normalizedIdentity(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    int size() {
        synchronized (this) {
            return windows.size();
        }
    }

    private String fingerprint(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt);
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 indisponible", impossible);
        }
    }

    private static long saturatedAdd(long left, long right) {
        try {
            return Math.addExact(left, right);
        } catch (ArithmeticException ignored) {
            return Long.MAX_VALUE;
        }
    }

    private static byte[] randomSalt() {
        byte[] salt = new byte[32];
        new SecureRandom().nextBytes(salt);
        return salt;
    }

    record Limit(int attempts, Duration window) {
        Limit validated() {
            if (attempts < 1 || window == null || window.isZero() || window.isNegative()) {
                throw new IllegalArgumentException("Configuration de rate limiting invalide.");
            }
            return this;
        }
    }

    private record Window(int count, long endsAtMillis) {
    }
}
