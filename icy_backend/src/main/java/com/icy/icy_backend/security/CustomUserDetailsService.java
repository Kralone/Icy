package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Utilisé par Spring Security uniquement pendant le login (mot de passe requis).
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé : " + username));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPassword()) // ✅ requis pour login
                .authorities(Collections.emptyList())
                .build();
    }

    /**
     * Utilisé après authentification pour injecter un utilisateur dans le contexte JWT.
     */
    public UserAuthDetails loadUserForContext(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé : " + username));

        return new UserAuthDetails(user.getId(), user.getUsername(), Collections.emptyList());
    }
}
