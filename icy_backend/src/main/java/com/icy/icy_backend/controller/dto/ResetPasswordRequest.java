package com.icy.icy_backend.controller.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class ResetPasswordRequest {
    private UUID id;
    private String newPassword;
}
