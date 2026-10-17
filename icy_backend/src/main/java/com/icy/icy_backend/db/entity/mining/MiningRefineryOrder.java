package com.icy.icy_backend.db.entity.mining;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Ordre de raffinage : le minerai raffiné reste sur le compte du lanceur jusqu'à sa remise au vendeur destinataire.
 * « Prêt » se déduit de finishes_at ; « remis » ne vient que d'une action explicite, même quand le lanceur est le destinataire.
 */
@Entity
@Table(name = "refinery_orders", schema = "mining")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MiningRefineryOrder {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "launcher_user_id", nullable = false) private UUID launcherUserId;
    @Column(name = "terminal_id") private Integer terminalId;
    @Column(name = "terminal_label", nullable = false, length = 200) private String terminalLabel;
    @Column(name = "method_code", length = 20) private String methodCode;
    @Column(name = "method_label", length = 80) private String methodLabel;
    @Column(nullable = false) private long cost;
    @Column(name = "finishes_at", nullable = false) private LocalDateTime finishesAt;
    @Column(name = "recipient_user_id", nullable = false) private UUID recipientUserId;
    @Column(name = "handed_over_at") private LocalDateTime handedOverAt;
    @Column(name = "ready_notified_at") private LocalDateTime readyNotifiedAt;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default private List<MiningRefineryOrderLine> lines = new ArrayList<>();

    public boolean isReady(LocalDateTime now) {
        return !now.isBefore(finishesAt);
    }

    public boolean isHandedOver() {
        return handedOverAt != null;
    }
}
