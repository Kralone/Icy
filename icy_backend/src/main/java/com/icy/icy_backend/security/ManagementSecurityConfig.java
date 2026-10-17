package com.icy.icy_backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Port de gestion (actuator), joignable seulement depuis le réseau Docker interne.
 * Prometheus y lit les métriques sans jeton ; tout autre point d'accès actuator reste refusé.
 * La chaîne principale de {@link SecurityConfig} ne voit donc jamais ce port.
 */
@Configuration
public class ManagementSecurityConfig {

    private final int managementPort;
    private final int serverPort;

    public ManagementSecurityConfig(@Value("${management.server.port:-1}") int managementPort,
                                    @Value("${server.port:8080}") int serverPort) {
        this.managementPort = managementPort;
        this.serverPort = serverPort;
    }

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain managementSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher(managementPortMatcher())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/prometheus").permitAll()
                        .anyRequest().denyAll()
                );
        return http.build();
    }

    /**
     * Ne correspond qu'au port de gestion déclaré. Sans port distinct, rien ne correspond :
     * l'API publique ne doit jamais tomber sous ces règles.
     */
    RequestMatcher managementPortMatcher() {
        boolean dedicatedPort = managementPort > 0 && managementPort != serverPort;
        return (HttpServletRequest request) -> dedicatedPort && request.getLocalPort() == managementPort;
    }
}
