package com.icy.icy_backend.db.entity.universe;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ore_locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OreLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_code", nullable = false, unique = true, length = 120)
    private String locationCode;

    @Column(name = "users_count", nullable = false)
    private Integer usersCount;

    @Column(name = "scans_count", nullable = false)
    private Integer scansCount;

    @Column(name = "clusters_count", nullable = false)
    private Integer clustersCount;

    @Column(name = "cluster_count_min", nullable = false)
    private Double clusterCountMin;

    @Column(name = "cluster_count_max", nullable = false)
    private Double clusterCountMax;

    @Column(name = "cluster_count_med", nullable = false)
    private Double clusterCountMed;

    @Column(name = "mass_min", nullable = false)
    private Double massMin;

    @Column(name = "mass_max", nullable = false)
    private Double massMax;

    @Column(name = "mass_med", nullable = false)
    private Double massMed;

    @Column(name = "inst_min", nullable = false)
    private Double instMin;

    @Column(name = "inst_max", nullable = false)
    private Double instMax;

    @Column(name = "inst_med", nullable = false)
    private Double instMed;

    @Column(name = "res_min", nullable = false)
    private Double resMin;

    @Column(name = "res_max", nullable = false)
    private Double resMax;

    @Column(name = "res_med", nullable = false)
    private Double resMed;

    @OneToMany(mappedBy = "oreLocation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("probability DESC, oreCode ASC")
    private List<OreLocationOre> ores = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
