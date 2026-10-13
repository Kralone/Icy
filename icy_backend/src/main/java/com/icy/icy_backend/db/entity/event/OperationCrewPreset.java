package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Modèle d'équipage réutilisable, géré par les administrateurs et copié dans une opération à la création d'une unité. */
@Entity
@Table(name = "operation_crew_presets", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationCrewPreset {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, length = 120) private String name;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(name = "ship_model_id") private Long shipModelId;
    /** Nom du modèle au moment de l'enregistrement : il reste lisible si le catalogue change. */
    @Column(name = "ship_model_name", nullable = false, length = 200) private String shipModelName;
    private Integer capacity;
    @Enumerated(EnumType.STRING) @Column(name = "position_mode", nullable = false, length = 20)
    @Builder.Default private OperationGroup.PositionMode positionMode = OperationGroup.PositionMode.SELF;
    @Column(nullable = false) @Builder.Default private boolean archived = false;
    @Column(name = "created_by") private UUID createdBy;
    @Column(name = "created_at", nullable = false) @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
    @Column(name = "updated_at") private LocalDateTime updatedAt;
}
