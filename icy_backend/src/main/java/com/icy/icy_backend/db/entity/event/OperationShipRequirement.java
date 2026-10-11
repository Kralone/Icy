package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "operation_ship_requirements", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationShipRequirement {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "operation_event_id", nullable = false) private UUID operationEventId;
    @Column(name = "group_id") private Long groupId;
    @Column(name = "ship_model_id") private Long shipModelId;
    @Column(nullable = false) @Builder.Default private int quantity = 1;
    @Column(columnDefinition = "TEXT") private String notes;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default private Status status = Status.OPEN;
    @Column(name = "created_at", nullable = false) @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    public enum Status { OPEN, FULFILLED, CANCELLED }
}
