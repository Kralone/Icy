package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.user.UserController;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserOnlineResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserProfileResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserProfileRequest;
import com.icy.icy_backend.controller.dto.user.UpdateUserRequest;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.user.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private MessageService messageService;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void userEndpointsReturnOk() throws Exception {
        when(userService.getUserByDiscordId(eq("123"))).thenReturn(okResponse(new User()));
        when(userService.createUser(eq("alice"), eq("123"), eq("USER"))).thenReturn(okResponse(new User()));
        when(userService.updateUser(any(), any(), any(), any())).thenReturn(okResponse(new User()));
        when(userService.resolveUser(any(UUID.class))).thenReturn(new User());
        when(userService.resolveUser(any(Long.class))).thenReturn(new User());
        when(userService.deactivateUser(any())).thenReturn(okResponse(null));
        User userWithRoles = new User();
        userWithRoles.setRoles(Set.of());
        when(userService.getAllActiveUsers()).thenReturn(okResponse(List.of(new UserResponseDTO(userWithRoles))));
        when(userService.getOnlineUsers()).thenReturn(okResponse(List.of(new UserOnlineResponseDTO(userWithRoles))));

        UpdateUserRequest update = new UpdateUserRequest();
        update.setId(UUID.randomUUID());
        update.setUsername("alice");
        update.setDiscordId("123");
        update.setRole("USER");

        mockMvc.perform(get("/api/users/123"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/users/create")
                        .contentType("application/json")
                        .content("{\"username\":\"alice\",\"discordId\":\"123\",\"role\":\"USER\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/users/update")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/users/by-id")
                        .param("id", UUID.randomUUID().toString()))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/users/by-discord")
                        .param("discordId", "123"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/users/all"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/users/online"))
                .andExpect(status().isOk());

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(userService.getCurrentUserProfile(eq(userId))).thenReturn(okResponse(new UserProfileResponseDTO(user, null)));
        when(userService.updateCurrentUserProfile(eq(userId), any()))
                .thenReturn(okResponse(new UserProfileResponseDTO(user, null)));
        when(userService.updateUserAvatar(eq(userId), any()))
                .thenReturn(okResponse(new UserProfileResponseDTO(user, null)));

        UpdateUserProfileRequest profileRequest = new UpdateUserProfileRequest();
        profileRequest.setDescription("desc");

        mockMvc.perform(get("/api/users/me/profile")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/users/me/profile")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(profileRequest)))
                .andExpect(status().isOk());
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file("file", "data".getBytes())
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




