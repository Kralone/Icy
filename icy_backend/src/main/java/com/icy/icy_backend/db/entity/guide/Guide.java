package com.icy.icy_backend.db.entity.guide;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_guides")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Guide {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 120) private String slug;
    @Column(nullable = false, length = 200) private String title;
    @Column(length = 500) private String summary;
    @Column(nullable = false, columnDefinition = "TEXT") private String content;
    @Column(nullable = false, length = 30) @Builder.Default private String status = "DRAFT";
    @Column(nullable = false) @Builder.Default private boolean published = false;
    @Column(name = "game_version", length = 40) private String gameVersion;
    @Column(name = "updated_at", nullable = false) @Builder.Default private LocalDateTime updatedAt = LocalDateTime.now();
    @Column(name = "created_at", nullable = false) @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
}
