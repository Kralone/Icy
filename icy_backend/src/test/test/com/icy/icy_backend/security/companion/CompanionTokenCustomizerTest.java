package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CompanionTokenCustomizerTest {

    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final CompanionTokenCustomizer customizer = new CompanionTokenCustomizer(users);
    private final RegisteredClient app = RegisteredClient.withId("icy-companion").clientId("icy-companion")
            .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("http://127.0.0.1/callback").build();

    @Test
    void accessTokenCarriesMemberIdRolesAndSession() {
        User user = member("pilote", "MEMBRE");
        Mockito.when(users.findByUsernameWithRoles("pilote")).thenReturn(Optional.of(user));
        OAuth2Authorization authorization = OAuth2Authorization.withRegisteredClient(app).id("session-1")
                .principalName("pilote").authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).build();
        JwtEncodingContext context = context(AuthorizationGrantType.REFRESH_TOKEN, authorization);

        customizer.customize(context);

        JwtClaimsSet claims = context.getClaims().build();
        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        assertThat(claims.<String>getClaim("preferred_username")).isEqualTo("pilote");
        assertThat(claims.<List<String>>getClaim("roles")).containsExactly("ROLE_MEMBRE");
        assertThat(claims.<String>getClaim("sid")).isEqualTo("session-1");
    }

    @Test
    void inactiveMemberGetsNoNewToken() {
        Mockito.when(users.findByUsernameWithRoles("pilote")).thenReturn(Optional.empty());
        JwtEncodingContext context = context(AuthorizationGrantType.REFRESH_TOKEN, null);

        assertThatThrownBy(() -> customizer.customize(context))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(e -> assertThat(((OAuth2AuthenticationException) e).getError().getErrorCode()).isEqualTo("invalid_grant"));
    }

    @Test
    void serviceTokenIsLeftUntouched() {
        JwtEncodingContext context = context(AuthorizationGrantType.CLIENT_CREDENTIALS, null);

        customizer.customize(context);

        assertThat(context.getClaims().build().getSubject()).isEqualTo("pilote");
        Mockito.verifyNoInteractions(users);
    }

    private JwtEncodingContext context(AuthorizationGrantType grant, OAuth2Authorization authorization) {
        JwtEncodingContext.Builder builder = JwtEncodingContext.with(JwsHeader.with(SignatureAlgorithm.RS256),
                        JwtClaimsSet.builder().subject("pilote"))
                .registeredClient(app)
                .principal(UsernamePasswordAuthenticationToken.authenticated("pilote", null, List.of()))
                .authorizationGrantType(grant)
                .tokenType(OAuth2TokenType.ACCESS_TOKEN);
        if (authorization != null) builder.authorization(authorization);
        return builder.build();
    }

    private static User member(String username, String roleName) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        Role role = new Role();
        role.setName(roleName);
        UserRole userRole = new UserRole();
        userRole.setRole(role);
        userRole.setUser(user);
        user.getRoles().add(userRole);
        return user;
    }
}
