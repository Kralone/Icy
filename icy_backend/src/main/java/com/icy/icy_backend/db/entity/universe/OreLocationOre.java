package com.icy.icy_backend.db.entity.universe;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "ore_location_ores")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OreLocationOre {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ore_location_id", nullable = false)
    private OreLocation oreLocation;

    @Column(name = "ore_code", nullable = false, length = 80)
    private String oreCode;

    @Column(name = "probability", nullable = false)
    private Double probability;

    @Column(name = "min_pct", nullable = false)
    private Double minPct;

    @Column(name = "max_pct", nullable = false)
    private Double maxPct;

    @Column(name = "med_pct", nullable = false)
    private Double medPct;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
