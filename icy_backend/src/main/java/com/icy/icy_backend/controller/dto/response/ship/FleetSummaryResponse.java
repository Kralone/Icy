package com.icy.icy_backend.controller.dto.response.ship;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class FleetSummaryResponse {
    private String name;
    private String imageUrl;
    private String focus;
    private String brandName;
    private String brandImageUrl;

    public FleetSummaryResponse(String name, String imageUrl, String focus, String brandName, String brandImageUrl) {
        this.name = name;
        this.imageUrl = imageUrl;
        this.focus = focus;
        this.brandName = brandName;
        this.brandImageUrl = brandImageUrl;
    }

    public FleetSummaryResponse(String name, String imageUrl, String focus, String brandImageUrl) {
        this(name, imageUrl, focus, null, brandImageUrl);
    }
}



