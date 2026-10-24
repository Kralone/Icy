package com.icy.icy_backend.db.entity.user;

import com.icy.icy_backend.db.entity.user.id.UserTutorialId;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Dernière version d'un tutoriel d'interface terminée ou passée par un joueur. */
@Entity
@Table(name = "user_tutorials", schema = "core")
@IdClass(UserTutorialId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserTutorial {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "tutorial_id", nullable = false, length = 64)
    private String tutorialId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private UserTutorialStatus status;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
