package com.icy.icy_backend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.net.URI;
import java.util.Arrays;

@EnableMethodSecurity(prePostEnabled = true)
@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final BotApiKeyAuthenticationFilter botApiKeyAuthenticationFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          BotApiKeyAuthenticationFilter botApiKeyAuthenticationFilter,
                          @Value("${icy.cors.allowed-origins:https://iceforge.fr}") String allowedOrigins) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.botApiKeyAuthenticationFilter = botApiKeyAuthenticationFilter;
        this.allowedOrigins = parseAllowedOrigins(allowedOrigins);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 🌐 CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // 🚫 CSRF désactivé car API stateless
                .csrf(csrf -> csrf.disable())
                // 🧠 Stateless: pas de session persistante, tout via JWT
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 🔐 Règles d’autorisation
                .authorizeHttpRequests(auth -> auth
                        // routes publiques
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/logout",
                                "/api/auth/reset-password",
                                "/api/front/**",
                                "/api/wikelo/ships",
                                "/api/utils/executive-hangar/config",
                                "/ws/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/recruitment").permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/ships",
                                "/api/ships/shipsByBrand",
                                "/api/ships/brands",
                                "/api/ships/brands/images"
                        ).permitAll()
                        // toutes les autres requêtes nécessitent un token valide
                        .anyRequest().authenticated()
                )
                // 🧱 Filtre JWT avant l’authentification standard
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(botApiKeyAuthenticationFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowCredentials(true);
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    public static List<String> parseAllowedOrigins(String configuredOrigins) {
        List<String> origins = Arrays.stream(configuredOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .distinct()
                .toList();
        if (origins.isEmpty()) {
            throw new IllegalArgumentException("Au moins une origine CORS exacte est requise.");
        }
        for (String origin : origins) {
            URI uri = URI.create(origin);
            if (origin.contains("*") || uri.getHost() == null
                    || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                    || (uri.getPath() != null && !uri.getPath().isEmpty())
                    || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IllegalArgumentException("Origine CORS invalide: " + origin);
            }
        }
        return origins;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}



