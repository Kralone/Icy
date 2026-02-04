package com.icy.icy_backend.controller.dto.response.ship;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class FleetSummaryResponse {
    private String name;
    private String imageUrl;
    private String focus;

    public FleetSummaryResponse(String name, String imageUrl, String focus) {
        this.name = name;
        this.imageUrl = imageUrl;
        this.focus = focus;
    }
}



