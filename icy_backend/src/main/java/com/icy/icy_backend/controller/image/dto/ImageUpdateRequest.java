package com.icy.icy_backend.controller.image.dto;

import java.util.List;
import java.util.Map;

public record ImageUpdateRequest(
        String category,
        String subcategory,
        List<String> tags,
        Map<String, String> tagColors
) {
}
