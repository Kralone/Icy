package com.icy.icy_backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class ClientAddressResolverTest {

    @Test
    void ignoresForwardedHeaderFromUntrustedPeer() {
        ClientAddressResolver resolver = new ClientAddressResolver("10.0.0.0/8");
        MockHttpServletRequest request = request("198.51.100.4", "203.0.113.9");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.4");
    }

    @Test
    void walksTrustedProxyChainFromRightAndStopsAtFirstUntrustedHop() {
        ClientAddressResolver resolver = new ClientAddressResolver("10.0.0.0/8,192.168.1.20");
        MockHttpServletRequest request = request("10.0.0.5", "203.0.113.9, 192.168.1.20, 10.0.0.6");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.9");
    }

    @Test
    void attackerPrependedAddressIsIgnoredWhenNearestForwarderIsUntrusted() {
        ClientAddressResolver resolver = new ClientAddressResolver("10.0.0.0/8");
        MockHttpServletRequest request = request("10.0.0.5", "203.0.113.9, 198.51.100.7");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.7");
    }

    @Test
    void malformedForwardedChainFallsBackToTrustedPeer() {
        ClientAddressResolver resolver = new ClientAddressResolver("10.0.0.0/8");
        MockHttpServletRequest request = request("10.0.0.5", "not-an-address");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }

    private static MockHttpServletRequest request(String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }
}
