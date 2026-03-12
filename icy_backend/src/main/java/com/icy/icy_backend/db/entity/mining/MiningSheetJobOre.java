package com.icy.icy_backend.db.entity.mining;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mining_sheet_job_ores", schema = "mining")
@Getter
@Setter
@NoArgsConstructor
public class MiningSheetJobOre {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private MiningSheetJob job;

    @Column(name = "ore_name", nullable = false, length = 120)
    private String oreName;

    @Column(name = "quantity_cscu", nullable = false)
    private BigDecimal quantityCscu;

    @Column(name = "include_in_sale", nullable = false)
    private Boolean includeInSale = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
