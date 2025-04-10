package com.icy.icy_backend.controller.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class UpdateUserRequest {
    private UUID id;
    private String username;
    private Long discordId;
    private String role;

}
