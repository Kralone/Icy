package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "history", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionHistory {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "actor_user_id", nullable = false) private UUID actorUserId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private Action action;
    @Column(length = 500) private String reason;
    @Column(nullable = false) private LocalDateTime at;

    public enum Action { SETTLED, REOPENED_SETTLEMENT, REOPENED_ACTIVE, CLOSED, FORCED_CLOSE, RECEIPT_CONFIRMED, RECEIPT_WITHDRAWN }
}
