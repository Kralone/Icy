package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "participants", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionParticipant {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    /** 100 = 1 part, 50 = demi-part, 0 = exclu du partage (toujours remboursé de ses frais). */
    @Column(name = "shares_centi", nullable = false) @Builder.Default private int sharesCenti = 100;
    /** Ordre d'arrivée : départage des restes d'arrondi. */
    @Column(name = "joined_at", nullable = false) private LocalDateTime joinedAt;
}
