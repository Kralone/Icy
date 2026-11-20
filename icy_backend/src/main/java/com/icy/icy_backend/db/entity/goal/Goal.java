package com.icy.icy_backend.db.entity.goal;

import com.icy.icy_backend.db.entity.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "goals", schema = "goals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String description;

    private int target;

    private int current;

    private boolean pinned;

    private boolean completed;

    private LocalDateTime createdAt;

    /** Pôle de rattachement d'un objectif principal ; null sans pôle, et toujours null pour une étape. */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private com.icy.icy_backend.db.entity.user.Specialty pole;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private Goal parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Goal> subGoals = new ArrayList<>();
}






