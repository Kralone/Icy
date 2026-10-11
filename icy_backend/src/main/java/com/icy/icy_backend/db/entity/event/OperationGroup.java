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

    public enum AssignmentMode { INHERITED, FREE, VALIDATION, MANAGED }
}
