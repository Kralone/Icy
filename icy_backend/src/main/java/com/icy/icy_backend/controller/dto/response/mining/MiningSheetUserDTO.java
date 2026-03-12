package com.icy.icy_backend.controller.dto.response.mining;

import java.util.List;
import java.util.UUID;

public record MiningSheetUserDTO(
        UUID id,
        String username,
        List<String> roles,
        String avatarUrl
) {
}
