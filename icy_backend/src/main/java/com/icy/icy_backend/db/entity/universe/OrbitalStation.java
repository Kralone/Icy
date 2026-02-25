package com.icy.icy_backend.db.entity.universe;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "orbital_stations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrbitalStation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true, length = 140)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 160)
    private String slug;

    @Column(name = "system_name", nullable = false, length = 80)
    private String systemName;

    @Enumerated(EnumType.STRING)
    @Column(name = "station_kind", nullable = false, length = 24)
    private StationKind stationKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "orbit_kind", nullable = false, length = 24)
    private StationOrbitKind orbitKind;

    @Column(name = "orbit_target", length = 140)
    private String orbitTarget;

    @Column(name = "lagrange_point", length = 12)
    private String lagrangePoint;

    @Column(name = "operator_name", length = 140)
    private String operatorName;

    @Column(name = "wiki_url", nullable = false, columnDefinition = "TEXT")
    private String wikiUrl;

    @Column(name = "image_url", nullable = false, columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "game_version", nullable = false, length = 20)
    private String gameVersion;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
