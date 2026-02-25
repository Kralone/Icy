package com.icy.icy_backend.db.entity.utils;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "exec_hangar_player_status", schema = "utils")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExecutiveHangarPlayerStatus {
    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "has_exec_ship", nullable = false)
    private Boolean hasExecShip;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by_user_id")
    private UUID updatedByUserId;
}
