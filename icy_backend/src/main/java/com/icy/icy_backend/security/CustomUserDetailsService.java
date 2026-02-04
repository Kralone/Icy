package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private static final Logger logger = LoggerFactory.getLogger(CustomUserDetailsService.class);
    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        logger.debug("Chargement de l'utilisateur : {}", username);

        User user = userRepository.findByUsernameWithRoles(username)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé : " + username));

        logger.debug("Utilisateur trouvé : {}", user.getUsername());

        // 🔹 Extraction des rôles à partir des UserRole
        List<GrantedAuthority> authorities = user.getRoles().stream()
                .map(UserRole::getRole)
                .map(role -> new SimpleGrantedAuthority(
                        role.getName().startsWith("ROLE_") ? role.getName() : "ROLE_" + role.getName()
                ))

                .collect(Collectors.toList());

        logger.debug("Authorities extraites : {}", authorities);

        return new UserAuthDetails(
                user.getId(),
                user.getUsername(),
                user.getPassword(),
                authorities
        );

    }
}





