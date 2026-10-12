package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "operation_crew_preset_positions", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationCrewPresetPosition {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "preset_id", nullable = false) private UUID presetId;
    @Column(nullable = false, length = 80) private String label;
    @Column(length = 40) private String icon;
    private Integer capacity;
    @Column(name = "sort_order", nullable = false) @Builder.Default private int sortOrder = 0;
}
