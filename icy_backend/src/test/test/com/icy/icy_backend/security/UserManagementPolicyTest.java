package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserManagementPolicyTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void officerCanManageRegularUsersOnly() {
        authenticate("OFFICIER");

        assertThatCode(() -> UserManagementPolicy.assertCanManage(userWithRole("USER"), "USER"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> UserManagementPolicy.assertCanManage(null, "ADMIN"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> UserManagementPolicy.assertCanManage(userWithRole("ADMIN"), "USER"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> UserManagementPolicy.assertCanManage(userWithRole("OFFICIER"), null))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void adminCanManagePrivilegedUsersAndRoles() {
        authenticate("ADMIN");

        assertThatCode(() -> UserManagementPolicy.assertCanManage(userWithRole("ADMIN"), "ADMIN"))
                .doesNotThrowAnyException();
    }

    private static void authenticate(String role) {
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
        var details = new UserAuthDetails(UUID.randomUUID(), "actor", "password", authorities);
        var authentication = new UsernamePasswordAuthenticationToken(details, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private static User userWithRole(String roleName) {
        Role role = new Role();
        role.setName(roleName);
        User user = new User();
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        user.setRoles(Set.of(userRole));
        return user;
    }
}
