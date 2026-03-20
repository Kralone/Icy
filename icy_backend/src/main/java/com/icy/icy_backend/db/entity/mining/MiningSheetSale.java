package com.icy.icy_backend.db.entity.mining;

import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mining_sheet_sales", schema = "mining")
@Getter
@Setter
@NoArgsConstructor
public class MiningSheetSale {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sheet_id", nullable = false)
    private MiningSheet sheet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "declared_by_user_id", nullable = false)
    private User declaredByUser;

    @Column(name = "credit_auec", nullable = false)
    private Long creditAuec;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
