package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Modèle de message privé. {pseudo}, {grade} et {pôle} sont remplacés à l'envoi. */
@Entity
@Table(name = "message_templates", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MessageTemplate {
    public static final String REMINDER = "RAPPEL_INACTIVITE";

    @Id @Column(length = 48) private String code;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Category category;
    @Column(nullable = false, length = 80) private String label;
    @Column(nullable = false, columnDefinition = "TEXT") private String body;
    /** Fichier de la bibliothèque d'images joint au message. */
    @Column(name = "media_file", length = 200) private String mediaFile;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @Column(name = "updated_by") private String updatedBy;

    public enum Category { RAPPEL, PROMOTION }
}
