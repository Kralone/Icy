package com.icy.icy_backend.db.entity.scworldevent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "sc_world_event_type")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScWorldEventType {

    @Id
    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "text_color", length = 50)
    private String textColor;

    @Column(name = "image_url", length = 512)
    private String imageUrl;

    /**
     * JSONB schema (versioned) describing scoring fields + milestones.
     * This can evolve over time.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_schema", columnDefinition = "jsonb", nullable = false)
    private String scoreSchema;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
