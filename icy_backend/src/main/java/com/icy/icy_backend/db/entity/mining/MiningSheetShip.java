package com.icy.icy_backend.db.entity.mining;

import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "mining_sheet_ships",
        schema = "mining",
        uniqueConstraints = @UniqueConstraint(columnNames = {"sheet_id", "ship_id", "added_by_user_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class MiningSheetShip {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sheet_id", nullable = false)
    private MiningSheet sheet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ship_id", nullable = false)
    private Ship ship;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "added_by_user_id", nullable = false)
    private User addedByUser;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
