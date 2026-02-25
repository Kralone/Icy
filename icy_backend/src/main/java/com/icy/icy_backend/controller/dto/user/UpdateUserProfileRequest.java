package com.icy.icy_backend.controller.dto.user;

import lombok.Data;

@Data
public class UpdateUserProfileRequest {
    private String description;
    private String status;
    private String avatarUrl;
    private Long favoriteShipId;
    private Boolean clearFavoriteShip;
    private Boolean notifGlobal;
    private Boolean notifEvents;
    private Boolean notifFleet;
    private Boolean notifGoals;
    private Boolean notifDiscord;
}
