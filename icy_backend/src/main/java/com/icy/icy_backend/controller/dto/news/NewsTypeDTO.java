package com.icy.icy_backend.controller.dto.news;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsTypeDTO {
    private Long id;
    private String name;
    private String color;
    private String imageUrl;
}



