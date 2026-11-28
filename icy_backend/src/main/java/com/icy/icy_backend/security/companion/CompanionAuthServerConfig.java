package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.security.PublicEndpointRateLimiter;
import com.icy.icy_backend.exception.definition.RateLimitExceededException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2RefreshTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Émetteur de jetons d'Icy Companion (option 2 du document de conception), ajouté à côté de la connexion du site
 * sans la modifier :
 * <ul>
 *   <li>/api/oauth2/authorize, /api/oauth2/token, /api/oauth2/revoke, /api/oauth2/jwks : OAuth2 standard,
 *       code d'autorisation avec PKCE obligatoire pour l'app ;</li>
 *   <li>/api/oauth2/login : page de connexion (session HTTP limitée à ce parcours) ;</li>
 *   <li>/api/companion/** : appels du service compagnon, avec son propre jeton (client_credentials).</li>
 * </ul>
 * Les jetons sont signés en RS256 avec une clé privée connue d'IceForge seul ; le service compagnon les vérifie avec
 * la clé publique (/api/oauth2/jwks). Les filtres de ce fichier passent avant celui du site ({@code SecurityConfig}),
 * qui garde toutes les autres adresses.
 */
@Configuration
@ConditionalOnProperty(prefix = "icy.companion-auth", name = "enabled", havingValue = "true")
public class CompanionAuthServerConfig {

    static final String BASE_PATH = "/api/oauth2";
    static final String LOGIN_PATH = BASE_PATH + "/login";

    @Bean
    @Order(1)
    SecurityFilterChain companionAuthorizationServerChain(HttpSecurity http,
                                                          RegisteredClientRepository clients,
                                                          OAuth2AuthorizationService authorizations,
                                                          AuthorizationServerSettings settings,
                                                          OAuth2TokenGenerator<?> companionTokenGenerator) throws Exception {
        http
                .oauth2AuthorizationServer(server -> {
                    server.registeredClientRepository(clients)
                            .authorizationService(authorizations)
                            .authorizationServerSettings(settings)
                            .tokenGenerator(companionTokenGenerator)
                            .clientAuthentication(client -> client
                                    .authenticationConverter(new PublicClientRefreshTokenSupport.ClientConverter())
                                    .authenticationProvider(new PublicClientRefreshTokenSupport.ClientProvider(clients)));
                    http.securityMatcher(server.getEndpointsMatcher());
                })
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                // Navigateur pas encore connecté : vers la page de connexion du compagnon, puis retour ici.
                .exceptionHandling(exceptions -> exceptions.defaultAuthenticationEntryPointFor(
                        new LoginUrlAuthenticationEntryPoint(LOGIN_PATH),
                        new MediaTypeRequestMatcher(MediaType.TEXT_HTML)));
        return http.build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain companionLoginChain(HttpSecurity http, UserRepository users, PasswordEncoder passwordEncoder,
                                            PublicEndpointRateLimiter rateLimiter) throws Exception {
        SimpleUrlAuthenticationFailureHandler failure = new SimpleUrlAuthenticationFailureHandler(LOGIN_PATH + "?error") {
            @Override
            public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                                org.springframework.security.core.AuthenticationException exception)
                    throws IOException, ServletException {
                try {
                    rateLimiter.recordLoginFailure(request, request.getParameter("username"));
                } catch (RateLimitExceededException ignored) {
                    // Déjà au plafond : la page d'erreur suffit, la prochaine tentative sera refusée avant le contrôle.
                }
                super.onAuthenticationFailure(request, response, exception);
            }
        };
        http
                .securityMatcher(LOGIN_PATH)
                .authenticationProvider(new CompanionLoginAuthenticationProvider(users, passwordEncoder))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .formLogin(form -> form
                        .loginPage(LOGIN_PATH)
                        .loginProcessingUrl(LOGIN_PATH)
                        .failureHandler(failure))
                .addFilterBefore(new LoginRateLimitFilter(rateLimiter), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    @Order(3)
    SecurityFilterChain companionServiceChain(HttpSecurity http, JwtDecoder companionServiceJwtDecoder) throws Exception {
        http
                .securityMatcher("/api/companion/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest()
                        .hasAuthority("SCOPE_" + CompanionAuthProperties.SERVICE_SCOPE))
                .oauth2ResourceServer(rs -> rs.jwt(jwt -> jwt.decoder(companionServiceJwtDecoder)));
        return http.build();
    }

    @Bean
    RegisteredClientRepository companionClients(CompanionAuthProperties properties, PasswordEncoder passwordEncoder) {
        List<RegisteredClient> clients = new ArrayList<>();
        clients.add(RegisteredClient.withId(CompanionAuthProperties.APP_CLIENT_ID)
                .clientId(CompanionAuthProperties.APP_CLIENT_ID)
                .clientName("Icy Companion")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE) // app installée : pas de secret, PKCE
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUris(uris -> uris.addAll(properties.getRedirectUris()))
                .scope("companion")
                .clientSettings(ClientSettings.builder()
                        .requireProofKey(true)
                        .requireAuthorizationConsent(false)
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(properties.getAccessTokenTtl())
                        .refreshTokenTimeToLive(properties.getRefreshTokenTtl())
                        .reuseRefreshTokens(false) // rotation : chaque renouvellement remplace le refresh token
                        .build())
                .build());
        if (!properties.getServiceClientSecret().isBlank()) {
            clients.add(RegisteredClient.withId(CompanionAuthProperties.SERVICE_CLIENT_ID)
                    .clientId(CompanionAuthProperties.SERVICE_CLIENT_ID)
                    .clientName("Service Icy Companion")
                    .clientSecret(passwordEncoder.encode(properties.getServiceClientSecret()))
                    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                    .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                    .scope(CompanionAuthProperties.SERVICE_SCOPE)
                    .tokenSettings(TokenSettings.builder()
                            .accessTokenTimeToLive(properties.getServiceTokenTtl())
                            .build())
                    .build());
        }
        return new InMemoryRegisteredClientRepository(clients);
    }

    @Bean
    OAuth2AuthorizationService companionAuthorizations(JdbcTemplate jdbc, RegisteredClientRepository clients) {
        return new JdbcOAuth2AuthorizationService(jdbc, clients);
    }

    @Bean
    RSAKey companionSigningKey(CompanionAuthProperties properties) {
        return CompanionSigningKey.load(properties.getSigningKey(), properties.getKeyId());
    }

    @Bean
    JWKSource<SecurityContext> companionJwkSource(RSAKey companionSigningKey) {
        return new ImmutableJWKSet<>(new JWKSet(companionSigningKey));
    }

    /** Vérifie les jetons du service compagnon reçus sur /api/companion/** : notre clé, notre émetteur, son audience. */
    @Bean
    JwtDecoder companionServiceJwtDecoder(RSAKey companionSigningKey, CompanionAuthProperties properties) throws Exception {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(companionSigningKey.toRSAPublicKey()).build();
        OAuth2TokenValidator<Jwt> audience = JwtValidators.createDefaultWithValidators(
                List.of(new org.springframework.security.oauth2.jwt.JwtIssuerValidator(properties.getIssuer()),
                        new org.springframework.security.oauth2.jwt.JwtClaimValidator<List<String>>("aud",
                                aud -> aud != null && aud.contains(CompanionAuthProperties.SERVICE_CLIENT_ID))));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(audience));
        return decoder;
    }

    @Bean
    AuthorizationServerSettings companionAuthorizationServerSettings(CompanionAuthProperties properties) {
        return AuthorizationServerSettings.builder()
                .issuer(properties.getIssuer())
                .authorizationEndpoint(BASE_PATH + "/authorize")
                .tokenEndpoint(BASE_PATH + "/token")
                .tokenRevocationEndpoint(BASE_PATH + "/revoke")
                .tokenIntrospectionEndpoint(BASE_PATH + "/introspect")
                .jwkSetEndpoint(BASE_PATH + "/jwks")
                .pushedAuthorizationRequestEndpoint(BASE_PATH + "/par")
                .deviceAuthorizationEndpoint(BASE_PATH + "/device_authorization")
                .deviceVerificationEndpoint(BASE_PATH + "/device_verification")
                .clientRegistrationEndpoint(BASE_PATH + "/register")
                .build();
    }

    /** Jetons d'accès JWT signés (avec le contenu de {@link CompanionTokenCustomizer}) et refresh tokens, app comprise. */
    @Bean
    OAuth2TokenGenerator<?> companionTokenGenerator(JWKSource<SecurityContext> companionJwkSource, UserRepository users) {
        JwtGenerator jwt = new JwtGenerator(new NimbusJwtEncoder(companionJwkSource));
        jwt.setJwtCustomizer(new CompanionTokenCustomizer(users));
        return new DelegatingOAuth2TokenGenerator(jwt, new PublicClientRefreshTokenSupport.Generator(),
                new OAuth2RefreshTokenGenerator());
    }

    /** Même plafond de tentatives que /api/auth/login, vérifié avant le contrôle du mot de passe. */
    static final class LoginRateLimitFilter extends OncePerRequestFilter {
        private final PublicEndpointRateLimiter rateLimiter;

        LoginRateLimitFilter(PublicEndpointRateLimiter rateLimiter) {
            this.rateLimiter = rateLimiter;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            if ("POST".equals(request.getMethod())) {
                try {
                    rateLimiter.checkLogin(request, request.getParameter("username"));
                } catch (RateLimitExceededException e) {
                    response.sendRedirect(request.getContextPath() + LOGIN_PATH + "?error");
                    return;
                }
            }
            chain.doFilter(request, response);
        }
    }
}
