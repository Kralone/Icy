package com.icy.icy_backend.controller.dto.response.auth;

import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
public class LoginResponseDTO {
    private Map<String, String> tokens;
    private UserResponseDTO user;
    private String passwordResetToken;

    public LoginResponseDTO(String accessToken, String refreshToken, UserResponseDTO user) {
        this(accessToken, refreshToken, user, null);
    }

    public LoginResponseDTO(String accessToken, String refreshToken, UserResponseDTO user, String passwordResetToken) {
        this.tokens = Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken
        );
        this.user = user;
        this.passwordResetToken = passwordResetToken;
    }
}






