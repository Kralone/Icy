package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Fiche de rappel d'un membre : quand il a été prévenu, s'il a répondu et ce qu'il a décidé. */
@Entity
@Table(name = "member_reminders", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MemberReminder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "campaign_id", nullable = false) private Long campaignId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    /** Jours sans activité au moment où la fiche a été créée. */
    @Column(name = "days_inactive") private Integer daysInactive;
    @Column(name = "contacted_at") private LocalDateTime contactedAt;
    /** Message privé envoyé par le bot ; null pour un rappel envoyé à la main. */
    @Column(name = "delivery_id") private UUID deliveryId;
    @Column(name = "answered_at") private LocalDateTime answeredAt;
    @Enumerated(EnumType.STRING) @Column(length = 16) private Decision decision;
    @Column(name = "pause_until") private LocalDate pauseUntil;
    @Column(length = 500) private String note;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @Column(name = "updated_by") private String updatedBy;

    /** REVIENT : reprend une activité régulière. PAUSE : absent jusqu'à une date. QUITTE : quitte la corpo. SANS_REPONSE : clos sans réponse. */
    public enum Decision { REVIENT, PAUSE, QUITTE, SANS_REPONSE }
}
