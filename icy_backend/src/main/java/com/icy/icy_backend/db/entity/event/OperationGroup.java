package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "operation_groups", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "operation_event_id", nullable = false) private UUID operationEventId;
    @Column(name = "parent_id") private Long parentId;
    @Column(nullable = false, length = 120) private String name;
    @Column(columnDefinition = "TEXT") private String description;
    private Integer capacity;
    @Enumerated(EnumType.STRING) @Column(name = "assignment_mode", nullable = false, length = 20)
    @Builder.Default private AssignmentMode assignmentMode = AssignmentMode.INHERITED;
    @Column(name = "sort_order", nullable = false) @Builder.Default private int sortOrder = 0;
    @Column(name = "responsible_user_id") private UUID responsibleUserId;
    /** CREW : équipage de vaisseau, toujours sans sous-groupe ; ses postes sont dans operation_group_positions. */
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    @Builder.Default private Kind kind = Kind.STANDARD;
    @Column(name = "ship_model_id") private Long shipModelId;
    /** Nom du modèle au moment du choix : il reste lisible si le catalogue change. */
    @Column(name = "ship_model_name", length = 200) private String shipModelName;
    @Enumerated(EnumType.STRING) @Column(name = "position_mode", nullable = false, length = 20)
    @Builder.Default private PositionMode positionMode = PositionMode.SELF;
    /** Preset dont l'équipage suit les modifications ; null : équipage indépendant (créé sans preset, ou retouché à la main). */
    @Column(name = "crew_preset_id") private UUID crewPresetId;

    public enum AssignmentMode { INHERITED, FREE, VALIDATION, MANAGED }
    public enum Kind { STANDARD, CREW }
    /** SELF : chaque membre choisit son poste. MANAGED : seuls les organisateurs et responsables les attribuent. */
    public enum PositionMode { SELF, MANAGED }
}
