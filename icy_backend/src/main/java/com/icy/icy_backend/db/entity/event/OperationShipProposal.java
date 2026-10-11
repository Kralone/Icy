package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "operation_ship_proposals", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationShipProposal {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name="operation_event_id", nullable=false) private UUID operationEventId;
    @Column(name="group_id") private Long groupId;
    @Column(name="requirement_id") private UUID requirementId;
    @Column(name="owner_user_id", nullable=false) private UUID ownerUserId;
    @Column(name="ship_id", nullable=false) private Long shipId;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) @Builder.Default private Status status=Status.PROPOSED;
    @Column(name="created_at", nullable=false) @Builder.Default private LocalDateTime createdAt=LocalDateTime.now();
    public enum Status { PROPOSED, ACCEPTED, DECLINED, UNAVAILABLE }
}
