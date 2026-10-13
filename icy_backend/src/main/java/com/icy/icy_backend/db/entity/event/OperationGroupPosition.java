package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;

/** Poste facultatif d'un équipage : une fonction à bord, pas un groupe ni une affectation. */
@Entity
@Table(name = "operation_group_positions", schema = "events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OperationGroupPosition {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "group_id", nullable = false) private Long groupId;
    @Column(nullable = false, length = 80) private String label;
    @Column(length = 40) private String icon;
    /** Null : pas de limite propre au poste, seule la capacité de l'équipage compte. */
    private Integer capacity;
    @Column(name = "sort_order", nullable = false) @Builder.Default private int sortOrder = 0;
}
