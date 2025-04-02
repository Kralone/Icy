package com.icy.icy_backend.controller.dto.response;

import com.icy.icy_backend.db.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UserResponseDTO {
    private UUID id;
    private String username;
    private List<String> roles;
    private Long discordId;

    public UserResponseDTO(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.roles = user.getRoles().stream()
                .map(userRole -> userRole.getRole().getName())
                .toList();
        this.discordId = user.getDiscordId();
    }
}
