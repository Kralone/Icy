package com.icy.icy_backend.controller.dto.news;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsRequest {
    private String title;
    private String content;
    private String imageUrl;
    private Long typeId;
}



