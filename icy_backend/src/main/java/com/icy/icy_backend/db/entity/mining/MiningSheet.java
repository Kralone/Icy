package com.icy.icy_backend.db.entity.mining;

import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "mining_sheets", schema = "mining")
@Getter
@Setter
@NoArgsConstructor
public class MiningSheet {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "sheet_name", nullable = false, length = 180)
    private String sheetName;

    @Column(name = "operation_date", nullable = false)
    private LocalDate operationDate;

    @Column(name = "refinery_location", nullable = false, length = 180)
    private String refineryLocation;

    @Column(name = "sale_location", length = 180)
    private String saleLocation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MiningSheetStatus status = MiningSheetStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "sheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private Set<MiningSheetMember> members = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private Set<MiningSheetJob> jobs = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private Set<MiningSheetShip> sheetShips = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private Set<MiningSheetSale> sales = new LinkedHashSet<>();

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
