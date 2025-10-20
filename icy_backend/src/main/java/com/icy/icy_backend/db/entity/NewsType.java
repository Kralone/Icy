package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "news_type")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String color;

    @Column(name = "image_url", length = 255)
    private String imageUrl;
}
