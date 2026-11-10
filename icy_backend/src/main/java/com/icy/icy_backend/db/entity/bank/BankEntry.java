package com.icy.icy_backend.db.entity.bank;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Mouvement du journal de la banque. Il ne se supprime pas : on l'annule avec un motif.
 * amount est positif, sauf pour un ajustement où son signe donne le sens de la correction.
 */
@Entity
@Table(name = "entries", schema = "bank")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BankEntry {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Kind kind;
    @Column(nullable = false) private long amount;
    /** Joueur qui donne (dépôt) ou qui reçoit (reversement) ; facultatif pour une dépense ou un ajustement. */
    @Column(name = "user_id") private UUID userId;
    @Column(name = "project_id") private UUID projectId;
    @Column(length = 300) private String note;
    @Column(name = "occurred_on", nullable = false) private LocalDate occurredOn;
    @Column(name = "recorded_by", nullable = false) private UUID recordedBy;
    @Column(name = "recorded_at", nullable = false) private LocalDateTime recordedAt;
    @Column(name = "cancelled_at") private LocalDateTime cancelledAt;
    @Column(name = "cancelled_by") private UUID cancelledBy;
    @Column(name = "cancel_reason", length = 300) private String cancelReason;

    public enum Kind { DEPOSIT, EXPENSE, PAYOUT, ADJUSTMENT }

    public boolean isCancelled() {
        return cancelledAt != null;
    }

    /** Effet sur le solde : un dépôt l'augmente, une dépense ou un reversement le diminue. */
    public long signedAmount() {
        return switch (kind) {
            case DEPOSIT, ADJUSTMENT -> amount;
            case EXPENSE, PAYOUT -> -amount;
        };
    }
}
