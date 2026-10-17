package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Règlement créé par l'arrêt des comptes : photographie des soldes et des versements.
 * Une réouverture vers ACTIVE l'annule sans l'effacer ; il reste consultable dans l'historique.
 */
@Entity
@Table(name = "settlements", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionSettlement {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "total_sales", nullable = false) private long totalSales;
    @Column(name = "total_expenses", nullable = false) private long totalExpenses;
    @Column(nullable = false) private long net;
    @Column(name = "cancelled_at") private LocalDateTime cancelledAt;
    @Column(name = "cancelled_by_user_id") private UUID cancelledByUserId;
    @Column(name = "closed_at") private LocalDateTime closedAt;
    @Enumerated(EnumType.STRING) @Column(name = "close_kind", length = 20) private CloseKind closeKind;
    @Column(name = "close_reason", length = 500) private String closeReason;
    @OneToMany(mappedBy = "settlement", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default private List<SessionSettlementShare> shares = new ArrayList<>();
    @OneToMany(mappedBy = "settlement", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default private List<SessionSettlementTransfer> transfers = new ArrayList<>();

    public enum CloseKind { NORMAL, FORCED }

    public boolean allReceived() {
        return transfers.stream().allMatch(transfer -> transfer.getReceivedAt() != null);
    }
}
