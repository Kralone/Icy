package com.icy.icy_backend.controller.dto.user;

import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class UpdateUserRequest {
    private UUID id;
    private String username;
    private String discordId;
    private String role;
    /** Fonction de trésorier, qui s'ajoute au grade ; null la laisse telle quelle. */
    private Boolean treasurer;

}



