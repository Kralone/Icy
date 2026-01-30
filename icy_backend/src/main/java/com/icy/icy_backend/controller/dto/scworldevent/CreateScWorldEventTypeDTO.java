package com.icy.icy_backend.controller.dto.scworldevent;

import lombok.Data;

@Data
public class CreateScWorldEventTypeDTO {
    private String name;
    private String textColor;
    private String imageUrl;
    /**
     * JSON string (stored as JSONB)
     */
    private String scoreSchema;
}
