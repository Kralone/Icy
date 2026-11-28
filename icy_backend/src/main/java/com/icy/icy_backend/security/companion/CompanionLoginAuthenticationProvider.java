package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

/**
 * Contrôle du mot de passe sur la page de connexion du compagnon : la même règle que {@code AuthService.authenticate}
 * (empreinte bcrypt, compte actif), sans le parcours de mot de passe temporaire, qui reste sur le site.
 * <p>
 * Le membre authentifié est un simple nom d'utilisateur avec ses rôles : l'émetteur range cette identité en base
 * (oauth2_authorization) et ne sait relire que des types standard.
 */
class CompanionLoginAuthenticationProvider implements AuthenticationProvider {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    /** Empreinte quelconque : un identifiant inconnu coûte le même temps qu'un mauvais mot de passe. */
    private final String dummyHash;

    CompanionLoginAuthenticationProvider(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String username = authentication.getName();
        String password = authentication.getCredentials() == null ? "" : authentication.getCredentials().toString();
        // Les comptes désactivés (exclus) sont invisibles pour cette recherche (@SQLRestriction sur User).
        User user = users.findByUsernameWithRoles(username).orElse(null);
        if (user == null) {
            passwordEncoder.matches(password, dummyHash);
            throw new BadCredentialsException("Identifiants incorrects");
        }
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadCredentialsException("Identifiants incorrects");
        }
        if (Boolean.TRUE.equals(user.getPwdReset())) {
            throw new DisabledException("Mot de passe temporaire : connecte-toi d'abord sur le site pour le changer.");
        }
        return UsernamePasswordAuthenticationToken.authenticated(user.getUsername(), null, authorities(user));
    }

    static List<GrantedAuthority> authorities(User user) {
        return user.getRoles().stream()
                .map(role -> role.getRole().getName())
                .map(name -> name.startsWith("ROLE_") ? name : "ROLE_" + name)
                .<GrantedAuthority>map(SimpleGrantedAuthority::new)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
