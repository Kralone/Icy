package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.user.Role;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.user.RoleRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.UserRoleRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class UserRoleServiceTest {

    @Test
    void assignRoleCreatesRoleWhenMissing() {
        UserRoleRepository userRoleRepository = Mockito.mock(UserRoleRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        RoleRepository roleRepository = Mockito.mock(RoleRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);

        UserRoleService service = new UserRoleService(userRoleRepository, userRepository, roleRepository, messageService);

        UUID userId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        Role role = new Role();
        role.setId(roleId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(userRoleRepository.findByUserId(userId)).thenReturn(List.of());

        ResponseEntity<MessageResponse<Void>> response = okResponse(null);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.created"), eq(null));

        assertThat(service.assignRoleToUser(userId, roleId)).isEqualTo(response);
        Mockito.verify(userRoleRepository).save(any(UserRole.class));
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
