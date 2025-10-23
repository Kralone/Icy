package com.icy.icy_backend.controller.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IceLinkBlockDTO {
    private Long id;
    private String name;
    private String icon;
    private String headline;
    private String content;
    private String description;
}
