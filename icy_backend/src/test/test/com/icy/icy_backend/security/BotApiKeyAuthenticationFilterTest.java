package com.icy.icy_backend.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class BotApiKeyAuthenticationFilterTest {
    private static final String KEY = "validation-bot-key-not-a-real-secret";

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void missingAndWrongCredentialsAreRejected() throws Exception {
        BotApiKeyAuthenticationFilter filter = new BotApiKeyAuthenticationFilter(KEY);
        for (String authorization : new String[] {null, "Bot wrong-key", "Bearer " + KEY}) {
            MockHttpServletRequest request = request("/api/user-ships/bot");
            if (authorization != null) request.addHeader("Authorization", authorization);
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(request, response, chain);

            assertThat(response.getStatus()).isEqualTo(401);
            verify(chain, never()).doFilter(request, response);
        }
    }

    @Test
    void validCredentialCreatesOnlyBotAuthority() throws Exception {
        BotApiKeyAuthenticationFilter filter = new BotApiKeyAuthenticationFilter(KEY);
        for (String path : new String[] {"/api/user-ships/bot", "/api/users/bot/create"}) {
            MockHttpServletRequest request = request(path);
            request.addHeader("Authorization", "Bot " + KEY);
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = (req, res) -> {
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                assertThat(authentication).isNotNull();
                assertThat(authentication.getAuthorities()).extracting("authority").containsExactly("ROLE_BOT");
            };

            filter.doFilter(request, response, chain);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }

    @Test
    void botHeaderIsIgnoredOutsideStrictPathScope() throws Exception {
        BotApiKeyAuthenticationFilter filter = new BotApiKeyAuthenticationFilter(KEY);
        for (String path : new String[] {
                "/api/user-ships", "/api/users/all", "/api/user-ships/bot-malicious", "/api/users/bot-malicious"
        }) {
            MockHttpServletRequest request = request(path);
            request.addHeader("Authorization", "Bot " + KEY);
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(request, response, chain);

            verify(chain).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }

    @Test
    void configuredRouteFailsClosedWhenSecretIsMissing() throws Exception {
        BotApiKeyAuthenticationFilter filter = new BotApiKeyAuthenticationFilter("");
        MockHttpServletRequest request = request("/api/user-ships/bot");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(503);
        verify(chain, never()).doFilter(request, response);
    }

    private static MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRequestURI(path);
        return request;
    }
}
