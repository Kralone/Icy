package com.icy.icy_backend.controller.dto.guide;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class GuideRequest {
    private String slug;
    private String title;
    private String summary;
    private String content;
    private String status;
    private boolean published;
    private String gameVersion;
}
