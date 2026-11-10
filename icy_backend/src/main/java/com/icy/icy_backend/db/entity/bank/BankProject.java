package com.icy.icy_backend.db.entity.bank;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Projet financé par la banque de guilde : un objectif facultatif, un vaisseau du catalogue facultatif. */
@Entity
@Table(name = "projects", schema = "bank")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BankProject {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, length = 120) private String name;
    @Column(length = 500) private String description;
    @Column(name = "target_amount") private Long targetAmount;
    @Column(name = "ship_id") private Long shipId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) @Builder.Default private Status status = Status.OPEN;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;

    public enum Status { OPEN, COMPLETED, CANCELLED }
}
