package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Message privé confié au bot Discord, et ce qu'il en est advenu. */
@Entity
@Table(name = "direct_messages", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DirectMessage {
    /** Identifiant de l'envoi, repris par le bot dans sa réponse. Attribué par le serveur. */
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    /** Ce qui a déclenché l'envoi : REMINDER, PROMOTION, WARNING… */
    @Column(nullable = false, length = 24) private String origin;
    /** Identifiant propre à l'origine (fiche de rappel, avertissement…), rendu tel quel avec le résultat. */
    @Column(length = 64) private String reference;
    @Column(columnDefinition = "TEXT") private String content;
    @Column(name = "embed_title", length = 256) private String embedTitle;
    @Column(name = "media_file", length = 200) private String mediaFile;
    @Column(name = "requested_by") private UUID requestedBy;
    @Column(name = "requested_at", nullable = false) private LocalDateTime requestedAt;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Status status;
    @Column(length = 40) private String reason;
    @Column(name = "completed_at") private LocalDateTime completedAt;

    public enum Status { PENDING, SENT, FAILED }
}
