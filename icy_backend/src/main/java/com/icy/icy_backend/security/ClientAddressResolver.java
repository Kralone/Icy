package com.icy.icy_backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Component
public class ClientAddressResolver {
    private static final int MAX_FORWARDED_HEADER_LENGTH = 2048;
    private static final int MAX_FORWARDED_HOPS = 20;
    private final List<Network> trustedProxies;

    public ClientAddressResolver(@Value("${icy.rate-limit.trusted-proxies:}") String configuredProxies) {
        this.trustedProxies = Arrays.stream(configuredProxies.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Network::parse)
                .toList();
    }

    public String resolve(HttpServletRequest request) {
        String remote = normalizeLiteral(request.getRemoteAddr());
        if (remote == null || !isTrusted(remote)) {
            return remote == null ? "unknown" : remote;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank() || forwarded.length() > MAX_FORWARDED_HEADER_LENGTH) {
            return remote;
        }

        String[] rawHops = forwarded.split(",");
        if (rawHops.length > MAX_FORWARDED_HOPS) {
            return remote;
        }
        List<String> hops = new ArrayList<>(rawHops.length);
        for (String rawHop : rawHops) {
            String hop = normalizeLiteral(rawHop.trim());
            if (hop == null) {
                return remote;
            }
            hops.add(hop);
        }

        String candidate = remote;
        for (int i = hops.size() - 1; i >= 0 && isTrusted(candidate); i--) {
            candidate = hops.get(i);
        }
        return candidate;
    }

    private boolean isTrusted(String address) {
        byte[] bytes = parseAddress(address);
        if (bytes == null) {
            return false;
        }
        return trustedProxies.stream().anyMatch(network -> network.contains(bytes));
    }

    private static String normalizeLiteral(String value) {
        byte[] bytes = parseAddress(value);
        if (bytes == null) {
            return null;
        }
        try {
            return InetAddress.getByAddress(bytes).getHostAddress();
        } catch (UnknownHostException impossible) {
            return null;
        }
    }

    private static byte[] parseAddress(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String literal = value.trim();
        if (literal.startsWith("[") && literal.endsWith("]")) {
            literal = literal.substring(1, literal.length() - 1);
        }
        boolean ipv4 = literal.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}");
        boolean ipv6 = literal.contains(":") && literal.matches("[0-9a-fA-F:.%]+?");
        if (!ipv4 && !ipv6) {
            return null;
        }
        try {
            return InetAddress.getByName(literal).getAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private record Network(byte[] address, int prefixLength) {
        static Network parse(String value) {
            String[] parts = value.split("/", -1);
            byte[] address = parseAddress(parts[0]);
            if (address == null || parts.length > 2) {
                throw new IllegalArgumentException("Proxy de confiance invalide.");
            }
            int maxBits = address.length * 8;
            int prefix = parts.length == 2 ? parsePrefix(parts[1], maxBits) : maxBits;
            return new Network(address, prefix);
        }

        private static int parsePrefix(String value, int maxBits) {
            try {
                int prefix = Integer.parseInt(value);
                if (prefix < 0 || prefix > maxBits) {
                    throw new IllegalArgumentException("CIDR de proxy invalide.");
                }
                return prefix;
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("CIDR de proxy invalide.", ex);
            }
        }

        boolean contains(byte[] candidate) {
            if (candidate.length != address.length) {
                return false;
            }
            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (candidate[i] != address[i]) {
                    return false;
                }
            }
            if (remainingBits == 0) {
                return true;
            }
            int mask = 0xff << (8 - remainingBits);
            return (candidate[fullBytes] & mask) == (address[fullBytes] & mask);
        }
    }
}
