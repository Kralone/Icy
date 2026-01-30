package com.icy.icy_backend.db.entity.scworldevent;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sc_world_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScWorldEvent {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at")
    private Instant endAt;

    // ✅ C'est ici que se fait le lien magique.
    // L'event pointe vers le Type. C'est le Type qui porte le scoreSchema.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "type_name", referencedColumnName = "name", nullable = false)
    private ScWorldEventType type;

    @Column(name = "banner_image_url", length = 512)
    private String bannerImageUrl;

    /**
     * JSONB array: [{ "type": "image|link", "url": "...", "caption": "..." }]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "gallery", columnDefinition = "jsonb", nullable = false)
    private String gallery;

    // ❌ SUPPRIMÉ : private String scoreSchemaSnapshot;
    // On ne stocke plus de copie statique.

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}