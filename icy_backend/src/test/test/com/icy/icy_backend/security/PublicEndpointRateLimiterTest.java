package com.icy.icy_backend.security;

import com.icy.icy_backend.exception.definition.RateLimitExceededException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PublicEndpointRateLimiterTest {

    @Test
    void rejectsAfterQuotaAndResetsAtWindowBoundary() {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-02T10:00:00Z"));
        PublicEndpointRateLimiter limiter = limiter(clock, 2, 100);
        MockHttpServletRequest request = request("198.51.100.8");

        limiter.checkRefresh(request);
        limiter.checkRefresh(request);
        assertThatThrownBy(() -> limiter.checkRefresh(request))
                .isInstanceOfSatisfying(RateLimitExceededException.class,
                        ex -> assertThat(ex.getRetryAfterSeconds()).isEqualTo(60));

        clock.advance(Duration.ofSeconds(60));
        assertThatCode(() -> limiter.checkRefresh(request)).doesNotThrowAnyException();
    }

    @Test
    void loginConsumesOnlyFailuresAndCombinesIdentityWithClientAddress() {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-02T10:00:00Z"));
        PublicEndpointRateLimiter limiter = limiter(clock, 2, 100);

        MockHttpServletRequest firstAddress = request("198.51.100.1");
        for (int i = 0; i < 20; i++) {
            limiter.checkLogin(firstAddress, "Alice");
        }
        limiter.recordLoginFailure(firstAddress, " Alice ");
        limiter.recordLoginFailure(firstAddress, "ALICE");
        assertThatThrownBy(() -> limiter.checkLogin(firstAddress, "alice"))
                .isInstanceOf(RateLimitExceededException.class);
        assertThatThrownBy(() -> limiter.recordLoginFailure(firstAddress, "alice"))
                .isInstanceOf(RateLimitExceededException.class);

        assertThatCode(() -> limiter.checkLogin(request("198.51.100.2"), "alice"))
                .doesNotThrowAnyException();
    }

    @Test
    void storageNeverExceedsConfiguredMaximum() {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-02T10:00:00Z"));
        PublicEndpointRateLimiter limiter = limiter(clock, 2, 100);

        for (int i = 0; i < 250; i++) {
            limiter.checkRecruitment(request("10.0." + (i / 250) + "." + (i % 250)));
        }

        assertThat(limiter.size()).isEqualTo(100);
    }

    private static PublicEndpointRateLimiter limiter(Clock clock, int attempts, int maximumEntries) {
        var limit = new PublicEndpointRateLimiter.Limit(attempts, Duration.ofSeconds(60));
        return new PublicEndpointRateLimiter(
                new ClientAddressResolver(""), clock, new byte[32], maximumEntries,
                limit, limit, limit, limit, limit
        );
    }

    private static MockHttpServletRequest request(String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        return request;
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
