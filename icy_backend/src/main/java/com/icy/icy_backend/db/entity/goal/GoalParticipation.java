package com.icy.icy_backend.db.entity.goal;

import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "goal_participations",
        schema = "goals",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"goal_id", "user_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalParticipation {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "goal_id", nullable = false)
    private Goal goal;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private int delta;

    @Column(name = "total_after")
    private int totalAfter;

    private LocalDateTime createdAt;
}
