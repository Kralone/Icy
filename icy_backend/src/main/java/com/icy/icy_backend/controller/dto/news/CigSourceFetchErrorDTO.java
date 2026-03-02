package com.icy.icy_backend.controller.dto.news;

public record CigSourceFetchErrorDTO(
        Long sourceId,
        String sourceLabel,
        String sourceUrl,
        String message
) {
}
