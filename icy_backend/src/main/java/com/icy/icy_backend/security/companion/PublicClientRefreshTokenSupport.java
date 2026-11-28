package com.icy.icy_backend.security.companion;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.keygen.Base64StringKeyGenerator;
import org.springframework.security.crypto.keygen.StringKeyGenerator;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * Refresh tokens pour l'app de bureau, qui est un client « public » (sans secret, protégé par PKCE).
 * <p>
 * Par défaut, Spring Authorization Server ne donne pas de refresh token à un client public, et ne sait pas
 * l'authentifier quand il revient avec. Sans cela, le membre devrait repasser par le navigateur toutes les 5 min.
 * Les deux pièces ci-dessous comblent ce manque, comme dans l'exemple officiel de Spring :
 * <ul>
 *   <li>{@link Generator} : émet un refresh token aléatoire (96 octets) pour l'app ;</li>
 *   <li>{@link ClientConverter} + {@link ClientProvider} : reconnaissent l'app sur {@code grant_type=refresh_token}.</li>
 * </ul>
 * La rotation ({@code reuseRefreshTokens=false}) et l'attache du refresh token à son client restent celles de Spring :
 * un refresh token volé et réutilisé après son remplacement est refusé.
 */
final class PublicClientRefreshTokenSupport {
    private PublicClientRefreshTokenSupport() {}

    static final class Generator implements OAuth2TokenGenerator<OAuth2RefreshToken> {
        private final StringKeyGenerator keys = new Base64StringKeyGenerator(Base64.getUrlEncoder().withoutPadding(), 96);

        @Override
        public OAuth2RefreshToken generate(OAuth2TokenContext context) {
            if (!OAuth2TokenType.REFRESH_TOKEN.equals(context.getTokenType())) return null;
            RegisteredClient client = context.getRegisteredClient();
            if (!client.getClientAuthenticationMethods().contains(ClientAuthenticationMethod.NONE)) return null;
            Instant issuedAt = Instant.now();
            Instant expiresAt = issuedAt.plus(client.getTokenSettings().getRefreshTokenTimeToLive());
            return new OAuth2RefreshToken(keys.generateKey(), issuedAt, expiresAt);
        }
    }

    static final class ClientConverter implements AuthenticationConverter {
        @Override
        public Authentication convert(HttpServletRequest request) {
            if (!AuthorizationGrantType.REFRESH_TOKEN.getValue().equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE))) {
                return null;
            }
            String clientId = request.getParameter(OAuth2ParameterNames.CLIENT_ID);
            if (!StringUtils.hasText(clientId) || StringUtils.hasText(request.getParameter(OAuth2ParameterNames.CLIENT_SECRET))
                    || request.getHeader("Authorization") != null) {
                return null; // client confidentiel : laissé aux convertisseurs de Spring
            }
            return new OAuth2ClientAuthenticationToken(clientId, ClientAuthenticationMethod.NONE, null, Map.of());
        }
    }

    static final class ClientProvider implements AuthenticationProvider {
        private final RegisteredClientRepository clients;

        ClientProvider(RegisteredClientRepository clients) {
            this.clients = clients;
        }

        @Override
        public Authentication authenticate(Authentication authentication) {
            OAuth2ClientAuthenticationToken token = (OAuth2ClientAuthenticationToken) authentication;
            if (!ClientAuthenticationMethod.NONE.equals(token.getClientAuthenticationMethod())) return null;
            RegisteredClient client = clients.findByClientId(token.getPrincipal().toString());
            if (client == null
                    || !client.getClientAuthenticationMethods().contains(ClientAuthenticationMethod.NONE)
                    || !client.getAuthorizationGrantTypes().contains(AuthorizationGrantType.REFRESH_TOKEN)) {
                throw new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_CLIENT);
            }
            return new OAuth2ClientAuthenticationToken(client, ClientAuthenticationMethod.NONE, null);
        }

        @Override
        public boolean supports(Class<?> authentication) {
            return OAuth2ClientAuthenticationToken.class.isAssignableFrom(authentication);
        }
    }
}
