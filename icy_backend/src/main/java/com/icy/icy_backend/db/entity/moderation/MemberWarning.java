package com.icy.icy_backend.db.entity.moderation;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Avertissement disciplinaire. userId n'est pas une association : un membre exclu est désactivé
 * et reste invisible pour JPA, mais son historique doit rester lisible.
 */
@Entity
@Table(name = "member_warnings", schema = "core")
@Getter @Setter @NoArgsConstructor
public class MemberWarning {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private WarningCategory category;
    @Column(nullable = false, columnDefinition = "TEXT") private String reason;
    /** 1er, 2e, 3e… parmi les avertissements en cours quand il a été donné. */
    @Column(nullable = false) private int rank;
    @Column(name = "issued_by_user_id") private UUID issuedByUserId;
    @Column(name = "issued_by_name", nullable = false) private String issuedByName;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "revoked_at") private LocalDateTime revokedAt;
    @Column(name = "revoked_by_name") private String revokedByName;
    @Column(name = "revoke_reason", length = 500) private String revokeReason;
    @Column(name = "dm_delivery_id") private UUID dmDeliveryId;
    @Enumerated(EnumType.STRING) @Column(name = "dm_status", nullable = false, length = 16) private DeliveryStatus dmStatus = DeliveryStatus.PENDING;
    @Column(name = "dm_failure", length = 32) private String dmFailure;

    public boolean isActive() {
        return revokedAt == null;
    }
}
