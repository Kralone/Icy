package com.icy.icy_backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.util.matcher.RequestMatcher;

import static org.assertj.core.api.Assertions.assertThat;

class ManagementSecurityConfigTest {

    @Test
    void onlyRequestsOnTheManagementPortUseTheMetricsRules() {
        RequestMatcher matcher = new ManagementSecurityConfig(8091, 8080).managementPortMatcher();

        assertThat(matcher.matches(requestOnPort(8091))).isTrue();
        assertThat(matcher.matches(requestOnPort(8080))).isFalse();
    }

    @Test
    void withoutDedicatedPortThePublicApiNeverMatches() {
        for (ManagementSecurityConfig config : new ManagementSecurityConfig[] {
                new ManagementSecurityConfig(-1, 8080),
                new ManagementSecurityConfig(0, 8080),
                new ManagementSecurityConfig(8080, 8080)
        }) {
            assertThat(config.managementPortMatcher().matches(requestOnPort(8080))).isFalse();
        }
    }

    private static MockHttpServletRequest requestOnPort(int port) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/prometheus");
        request.setLocalPort(port);
        return request;
    }
}
