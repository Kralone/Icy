package com.icy.icy_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Component
public class BotApiKeyAuthenticationFilter extends OncePerRequestFilter {
    static final String BOT_PATH = "/api/user-ships/bot";
    private final byte[] expectedKey;

    public BotApiKeyAuthenticationFilter(@Value("${bot.api-key:}") String apiKey) {
        this.expectedKey = apiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(BOT_PATH.equals(path) || path.startsWith(BOT_PATH + "/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (expectedKey.length == 0) {
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Bot API authentication is not configured");
            return;
        }

        String authorization = request.getHeader("Authorization");
        byte[] suppliedKey = authorization != null && authorization.startsWith("Bot ")
                ? authorization.substring(4).getBytes(StandardCharsets.UTF_8)
                : new byte[0];
        if (!MessageDigest.isEqual(expectedKey, suppliedKey)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid bot credentials");
            return;
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_BOT"));
        var authentication = new UsernamePasswordAuthenticationToken("iceforge-bot", null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
