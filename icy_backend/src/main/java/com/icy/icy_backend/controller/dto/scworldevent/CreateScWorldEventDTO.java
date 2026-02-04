package com.icy.icy_backend.controller.dto.scworldevent;

import lombok.Data;

import java.time.Instant;

@Data
public class CreateScWorldEventDTO {
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private String typeName;
    private String bannerImageUrl;
    /**
     * JSON array string (stored as JSONB)
     */
    private String gallery;
}


