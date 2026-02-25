package com.icy.icy_backend.controller.dto.request.admin;

public record ItemUpsertRequest(
        String name,
        String manufacturer,
        String imageUrl,
        String description,
        String stats,
        Long categoryId
) {
}
