package com.icy.icy_backend.controller.dto.news;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsDTO {
    private Long id;
    private String title;
    private String content;
    private String author;
    private LocalDateTime createdAt;
    private NewsTypeDTO type;
}



