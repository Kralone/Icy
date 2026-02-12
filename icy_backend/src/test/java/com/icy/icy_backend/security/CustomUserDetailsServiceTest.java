package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class CustomUserDetailsServiceTest {

    @Test
    void loadUserByUsernameBuildsAuthorities() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setName("ADMIN");

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setPassword("secret");

        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        user.setRoles(Set.of(userRole));

        when(userRepository.findByUsernameWithRoles("alice")).thenReturn(Optional.of(user));

        UserDetails details = service.loadUserByUsername("alice");
        assertThat(details.getUsername()).isEqualTo("alice");
        assertThat(details.getAuthorities()).extracting("authority").contains("ROLE_ADMIN");
    }
}
