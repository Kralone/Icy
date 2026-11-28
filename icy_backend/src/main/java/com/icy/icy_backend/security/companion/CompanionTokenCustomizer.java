package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Contenu des jetons d'accès de l'app, relu en base à chaque émission (connexion et chaque renouvellement) :
 * <ul>
 *   <li>{@code sub} : identifiant du membre IceForge (UUID), la clé sous laquelle le service compagnon range ses données ;</li>
 *   <li>{@code preferred_username} : pseudo ;</li>
 *   <li>{@code roles} : rôles actuels (un rôle retiré disparaît au renouvellement suivant) ;</li>
 *   <li>{@code sid} : identifiant de la session de l'app, pour la révoquer seule.</li>
 * </ul>
 * Un compte désactivé ou supprimé n'obtient plus de jeton : le renouvellement est refusé ({@code invalid_grant}).
 */
class CompanionTokenCustomizer implements OAuth2TokenCustomizer<JwtEncodingContext> {
    static final String CLAIM_SID = "sid";
    static final String CLAIM_ROLES = "roles";
    static final String CLAIM_USERNAME = "preferred_username";

    private final UserRepository users;

    CompanionTokenCustomizer(UserRepository users) {
        this.users = users;
    }

    @Override
    public void customize(JwtEncodingContext context) {
        if (!OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) return;
        AuthorizationGrantType grant = context.getAuthorizationGrantType();
        if (!AuthorizationGrantType.AUTHORIZATION_CODE.equals(grant) && !AuthorizationGrantType.REFRESH_TOKEN.equals(grant)) {
            return; // jeton du service compagnon (client_credentials) : pas de membre derrière
        }
        String username = context.getPrincipal().getName();
        User user = users.findByUsernameWithRoles(username)
                .orElseThrow(() -> new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT,
                        "Compte IceForge inactif ou introuvable.", null)));
        // ArrayList et non List.of/toList : les claims sont relus depuis la base par Jackson, qui n'accepte que des
        // types connus.
        List<String> roles = CompanionLoginAuthenticationProvider.authorities(user).stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toCollection(ArrayList::new));
        context.getClaims()
                .subject(user.getId().toString())
                .claim(CLAIM_USERNAME, user.getUsername())
                .claim(CLAIM_ROLES, roles);
        if (context.getAuthorization() != null) {
            context.getClaims().claim(CLAIM_SID, context.getAuthorization().getId());
        }
    }
}
