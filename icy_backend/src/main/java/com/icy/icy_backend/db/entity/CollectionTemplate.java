package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "template")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 32)
    private String archetype;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "axis_x", columnDefinition = "jsonb", nullable = false)
    private String axisX;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "axis_y", columnDefinition = "jsonb", nullable = false)
    private String axisY;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "defaults", columnDefinition = "jsonb")
    private String defaults;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
