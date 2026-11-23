package com.icy.icy_backend.db.entity.moderation;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Décision prise au seuil d'avertissements. Le ban Discord d'une exclusion se fait à la main ; discordBanDoneAt le confirme. */
@Entity
@Table(name = "member_sanctions", schema = "core")
@Getter @Setter @NoArgsConstructor
public class MemberSanction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private SanctionDecision decision;
    @Column(length = 1000) private String note;
    @Column(name = "decided_by_user_id") private UUID decidedByUserId;
    @Column(name = "decided_by_name", nullable = false) private String decidedByName;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "discord_ban_done_at") private LocalDateTime discordBanDoneAt;
    @Column(name = "discord_ban_done_by") private String discordBanDoneBy;
    @Column(name = "dm_delivery_id") private UUID dmDeliveryId;
    @Enumerated(EnumType.STRING) @Column(name = "dm_status", length = 16) private DeliveryStatus dmStatus;
    @Column(name = "dm_failure", length = 32) private String dmFailure;
}
