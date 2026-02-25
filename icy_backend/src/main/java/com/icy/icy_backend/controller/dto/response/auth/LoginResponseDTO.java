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

    public LoginResponseDTO(String accessToken, String refreshToken, UserResponseDTO user) {
        this.tokens = Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken
        );
        this.user = user;
    }
}






