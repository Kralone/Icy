package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Campagne de rappel : un message et les membres à prévenir, chacun avec sa fiche.
 * BOT : le bot envoie, tout de suite ou à l'heure programmée. MANUEL : l'officier envoie lui-même et coche les fiches.
 */
@Entity
@Table(name = "reminder_campaigns", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReminderCampaign {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String body;
    @Column(name = "media_file", length = 200) private String mediaFile;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Delivery delivery;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Status status;
    @Column(name = "scheduled_at") private LocalDateTime scheduledAt;
    @Column(name = "sent_at") private LocalDateTime sentAt;
    @Column(name = "created_by") private UUID createdBy;
    @Column(name = "created_by_name", nullable = false) private String createdByName;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;

    public enum Delivery { BOT, MANUEL }

    /** BROUILLON : rien n'est parti. PROGRAMMEE : le bot enverra à scheduledAt. EN_COURS : rappels partis, suivi des réponses. */
    public enum Status { BROUILLON, PROGRAMMEE, EN_COURS, ANNULEE }
}
