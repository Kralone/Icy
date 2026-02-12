package com.icy.icy_backend.controller.dto.response.user;

import com.icy.icy_backend.db.entity.user.User;
import lombok.Data;

import java.util.UUID;

@Data
public class UserOnlineResponseDTO {
    private UUID id;
    private String username;
    private String status;
    private String avatarUrl;

    public UserOnlineResponseDTO(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.status = user.getStatus() != null ? user.getStatus().toApiValue() : null;
        this.avatarUrl = user.getAvatarUrl();
    }
}
