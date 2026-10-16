package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Frais avancé hors raffinage : le coût d'un ordre de raffinage est porté par l'ordre lui-même. */
@Entity
@Table(name = "expenses", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionExpense {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "payer_user_id", nullable = false) private UUID payerUserId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Kind kind;
    @Column(nullable = false) private long amount;
    @Column(length = 200) private String note;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;

    public enum Kind { FUEL, REPAIR, MATERIAL, OTHER }
}
