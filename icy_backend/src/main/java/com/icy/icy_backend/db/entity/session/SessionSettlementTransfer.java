package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Versement à faire en jeu ; seul le receveur (ou un organisateur, tracé) confirme l'avoir reçu. */
@Entity
@Table(name = "settlement_transfers", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionSettlementTransfer {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "settlement_id", nullable = false)
    private SessionSettlement settlement;
    @Column(name = "from_user_id", nullable = false) private UUID fromUserId;
    @Column(name = "to_user_id", nullable = false) private UUID toUserId;
    @Column(nullable = false) private long amount;
    @Column(nullable = false) private int position;
    @Column(name = "received_at") private LocalDateTime receivedAt;
    @Column(name = "received_by_user_id") private UUID receivedByUserId;
}
