package com.icy.icy_backend.db.entity.scworldevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.icy.icy_backend.db.entity.User;
import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sc_world_event_participation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScWorldEventParticipation {

    @Id
    @Column(nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scwe_id", nullable = false)
    private ScWorldEvent scWorldEvent;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // IMPORTANT: jsonb mapping
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "points", columnDefinition = "jsonb", nullable = false)
    private JsonNode points;

    @Column(name = "total", nullable = false)
    private int total;

    @Column(nullable = false, columnDefinition = "smallint")
    private short status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
