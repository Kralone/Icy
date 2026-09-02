package com.icy.icy_backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;

class SecurityConfigCorsTest {

    @Test
    void validationOriginIsAcceptedOnlyWhenExplicitlyConfigured() {
        SecurityConfig config = new SecurityConfig(
                mock(JwtAuthenticationFilter.class),
                mock(BotApiKeyAuthenticationFilter.class),
                "https://iceforge.fr, http://127.0.0.1:8088"
        );
        UrlBasedCorsConfigurationSource source =
                (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfigurations().get("/**");

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("http://127.0.0.1:8088")).isEqualTo("http://127.0.0.1:8088");
        assertThat(cors.checkOrigin("http://evil.example")).isNull();
        assertThat(cors.getAllowedOrigins()).containsExactly("https://iceforge.fr", "http://127.0.0.1:8088");
    }

    @Test
    void wildcardAndNonOriginUrlsAreRejected() {
        for (String invalid : List.of("*", "https://iceforge.fr/path", "file://iceforge")) {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> SecurityConfig.parseAllowedOrigins(invalid));
        }
    }
}
