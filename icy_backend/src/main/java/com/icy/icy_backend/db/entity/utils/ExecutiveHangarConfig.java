package com.icy.icy_backend.db.entity.utils;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "exec_hangar_config", schema = "utils")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExecutiveHangarConfig {
    @Id
    @Column(name = "id", nullable = false)
    private Short id;

    @Column(name = "initial_open_time", nullable = false)
    private OffsetDateTime initialOpenTime;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by_user_id")
    private UUID updatedByUserId;
}
