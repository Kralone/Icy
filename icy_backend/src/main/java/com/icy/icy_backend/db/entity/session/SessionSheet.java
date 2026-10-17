package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Fiche de session (minage pour l'instant) : participants, frais, ventes et règlements s'y rattachent par sheet_id. */
@Entity
@Table(name = "sheets", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionSheet {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, length = 20) @Builder.Default private String activity = "MINING";
    @Column(nullable = false, length = 160) private String name;
    @Column(name = "session_date", nullable = false) private LocalDate sessionDate;
    @Column(name = "organizer_user_id", nullable = false) private UUID organizerUserId;
    /** Opération d'origine ; null pour une fiche libre ou si l'opération a été supprimée. */
    @Column(name = "operation_event_id", unique = true) private UUID operationEventId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    @Builder.Default private Status status = Status.ACTIVE;
    /** Avance à chaque écriture : une fiche ouverte sait qu'elle doit se relire. */
    @Column(nullable = false) @Builder.Default private long revision = 0;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;

    public enum Status { ACTIVE, SETTLEMENT, CLOSED }

    public void touch(LocalDateTime now) {
        revision++;
        updatedAt = now;
    }
}
