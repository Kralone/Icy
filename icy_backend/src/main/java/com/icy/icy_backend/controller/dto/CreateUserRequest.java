package com.icy.icy_backend.controller.dto;

import lombok.Getter;
import com.fasterxml.jackson.annotation.JsonProperty;


@Getter
public class CreateUserRequest {
        private String username;
        @JsonProperty("discordId")
        private Long discordId;
}
