package com.icy.icy_backend.db.entity.utils;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wikelo_ships", schema = "utils")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WikeloShip {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ship_name", nullable = false, unique = true, length = 255)
    private String shipName;

    @Column(name = "mission_text", columnDefinition = "TEXT")
    private String missionText;

    @Column(name = "cost_text", columnDefinition = "TEXT")
    private String costText;

    @Column(name = "reputation_text", columnDefinition = "TEXT")
    private String reputationText;

    @Column(name = "components_text", columnDefinition = "TEXT")
    private String componentsText;

    @Column(name = "source_sheet", nullable = false, length = 120)
    private String sourceSheet;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "scraped_at", nullable = false)
    private LocalDateTime scrapedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
