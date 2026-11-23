package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Correction manuelle de l'état calculé d'un membre : noté actif ou en pause, jusqu'à une date facultative. */
@Entity
@Table(name = "member_follow_up", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MemberFollowUp {
    @Id @Column(name = "user_id") private UUID userId;
    @Enumerated(EnumType.STRING) @Column(name = "manual_state", length = 16) private ManualState manualState;
    /** Dernier jour où la correction s'applique ; null = sans limite. */
    @Column(name = "manual_until") private LocalDate manualUntil;
    @Column(length = 500) private String note;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @Column(name = "updated_by") private String updatedBy;

    public enum ManualState { ACTIF, EN_PAUSE }

    public boolean appliesOn(LocalDate day) {
        return manualState != null && (manualUntil == null || !manualUntil.isBefore(day));
    }
}
