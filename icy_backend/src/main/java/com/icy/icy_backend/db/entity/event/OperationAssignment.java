package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "operation_assignments", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationAssignment {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "operation_event_id", nullable = false) private UUID operationEventId;
    @Column(name = "group_id", nullable = false) private Long groupId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default private Status status = Status.CONFIRMED;
    @Column(name = "created_at", nullable = false) @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
    /** Poste à bord, facultatif, dans l'équipage de `groupId`. */
    @Column(name = "position_id") private Long positionId;
    public enum Status { CONFIRMED, PENDING }

    /** Change de groupe : le poste appartenait à l'ancien équipage, il est libéré dans la même écriture. */
    public void moveTo(Long targetGroupId) {
        if (!java.util.Objects.equals(groupId, targetGroupId)) positionId = null;
        groupId = targetGroupId;
    }
}
