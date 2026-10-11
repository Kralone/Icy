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

    @Column(name = "ship_name", nullable = false, length = 255)
    private String shipName;

    @Column(name = "mission_text", columnDefinition = "TEXT")
    private String missionText;

    @Column(name = "cost_text", columnDefinition = "TEXT")
    private String costText;

    @Column(name = "reputation_text", columnDefinition = "TEXT")
    private String reputationText;

    @Column(name = "components_text", columnDefinition = "TEXT")
    private String componentsText;

    @Column(name = "rewards_text", columnDefinition = "TEXT")
    private String rewardsText;

    @Column(name = "reward_manufacturer", length = 255)
    private String rewardManufacturer;

    @Column(name = "reward_image_url", columnDefinition = "TEXT")
    private String rewardImageUrl;

    @Column(name = "source_version", nullable = false, length = 120)
    private String sourceVersion;

    @Column(name = "mission_id", nullable = false, length = 36)
    private String missionId;

    @Column(name = "reward_uuid", nullable = false, length = 36)
    private String rewardUuid;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "scraped_at", nullable = false)
    private LocalDateTime scrapedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
