package com.icy.icy_backend.controller.dto.response.user;

import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserParam;
import lombok.Data;

import java.util.UUID;
import java.util.List;

@Data
public class UserProfileResponseDTO {
    private UUID id;
    private String username;
    private String discordId;
    private String description;
    private String status;
    private String avatarUrl;
    private FavoriteShipDTO favoriteShip;
    private NotificationSettingsDTO notifications;
    private List<String> roles;

    public UserProfileResponseDTO(User user, UserParam userParam) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.discordId = user.getDiscordId();
        this.description = user.getDescription();
        this.status = user.getStatus() != null ? user.getStatus().toApiValue() : null;
        this.avatarUrl = user.getAvatarUrl();
        this.favoriteShip = buildFavoriteShip(user.getFavoriteShip());
        this.roles = user.getRoles().stream()
                .map(userRole -> userRole.getRole().getName())
                .toList();
        if (userParam != null) {
            this.notifications = new NotificationSettingsDTO(
                    userParam.getNotifGlobal(),
                    userParam.getNotifEvents(),
                    userParam.getNotifFleet(),
                    userParam.getNotifGoals(),
                    userParam.getNotifDiscord()
            );
        }
    }

    private FavoriteShipDTO buildFavoriteShip(Ship ship) {
        if (ship == null) {
            return null;
        }
        return new FavoriteShipDTO(ship.getId(), ship.getName(), ship.getImageUrl());
    }

    @Data
    public static class FavoriteShipDTO {
        private final Long id;
        private final String name;
        private final String imageUrl;
    }

    @Data
    public static class NotificationSettingsDTO {
        private final Boolean global;
        private final Boolean events;
        private final Boolean fleet;
        private final Boolean goals;
        private final Boolean discord;
    }
}
