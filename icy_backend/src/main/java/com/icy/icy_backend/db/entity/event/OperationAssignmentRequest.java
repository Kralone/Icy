package com.icy.icy_backend.db.entity.event;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;
@Entity @Table(name="operation_assignment_requests", schema="events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationAssignmentRequest {
 @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
 @Column(name="operation_event_id", nullable=false) private UUID operationEventId;
 @Column(name="group_id", nullable=false) private Long groupId;
 @Column(name="user_id", nullable=false) private UUID userId;
 @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) @Builder.Default private Status status=Status.PENDING;
 @Column(name="created_at", nullable=false) @Builder.Default private LocalDateTime createdAt=LocalDateTime.now();
 public enum Status { PENDING, APPROVED, REFUSED, CANCELLED }
}
