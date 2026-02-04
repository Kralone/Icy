package com.icy.icy_backend.controller.dto.scworldevent;

import lombok.Data;

import java.time.Instant;

@Data
public class UpdateScWorldEventDTO {
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private String typeName;
    private String bannerImageUrl;
    private String gallery;
}


