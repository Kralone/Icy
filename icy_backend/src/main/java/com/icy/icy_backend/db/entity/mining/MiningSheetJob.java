package com.icy.icy_backend.db.entity.mining;

import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "mining_sheet_jobs", schema = "mining")
@Getter
@Setter
@NoArgsConstructor
public class MiningSheetJob {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sheet_id", nullable = false)
    private MiningSheet sheet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MiningSheetJobType type;

    @Column(name = "refinery_method", length = 120)
    private String refineryMethod;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "cost_auec", nullable = false)
    private Integer costAuec = 0;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "finish_at")
    private LocalDateTime finishAt;

    @Column(name = "notes")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private Set<MiningSheetJobOre> ores = new LinkedHashSet<>();

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
