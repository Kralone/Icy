package com.icy.icy_backend.controller.dto.user;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

@Getter
public class AddUserShip {
    @JsonProperty("discordId")
    private String discordId;
    private Long shipId;
    private boolean isInGame;
    private boolean isLoaner;
}



