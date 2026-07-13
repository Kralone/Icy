package com.icy.icy_backend.controller.dto.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResetPasswordRequest {
    private String resetToken;
    private String newPassword;
}



