package com.icy.icy_backend.db.entity.pole;

import com.icy.icy_backend.db.entity.user.Specialty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Actualité d'un pôle, publiée par un de ses gestionnaires. */
@Entity
@Table(name = "pole_news", schema = "core")
@Getter @Setter @NoArgsConstructor
public class PoleNews {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Specialty pole;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String content;
    /** null si le compte de l'auteur a été supprimé ; son pseudo reste dans authorName. */
    @Column(name = "author_user_id") private UUID authorUserId;
    @Column(name = "author_name", nullable = false) private String authorName;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
}
