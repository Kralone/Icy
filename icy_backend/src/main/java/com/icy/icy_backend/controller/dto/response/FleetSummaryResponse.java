package com.icy.icy_backend.controller.dto.response;

import lombok.Setter;

@Setter
public class FleetSummaryResponse {
    private String name;
    private String imageUrl;

    public FleetSummaryResponse(String name, String imageUrl) {
        this.name = name;
        this.imageUrl = imageUrl;
    }
}
