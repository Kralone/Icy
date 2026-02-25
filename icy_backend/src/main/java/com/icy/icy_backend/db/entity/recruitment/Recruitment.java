package com.icy.icy_backend.db.entity.recruitment;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "recruitment", schema = "recruitment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recruitment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 128)
    private String username;

    @Column(nullable = false, length = 256)
    private String discordTag;

    @Column(nullable = false, length = 256)
    private String motivation;

    @Column(length = 256)
    private String referral;

    @Column(length = 256)
    private String experience;

    @Column(length = 256)
    private String preferredGameplay;

    @Column(nullable = false)
    @Builder.Default
    private boolean accept = false;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(length = 256)
    @Builder.Default
    private String status = "PENDING";

    @Column(length = 256)
    private String comment;

    // --- Constructeur de conversion depuis le DTO ---
    public Recruitment(com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO dto) {
        this.id = dto.getId();
        this.username = dto.getUsername();
        this.discordTag = dto.getDiscordTag();
        this.motivation = dto.getMotivation();
        this.referral = dto.getReferral();
        this.experience = dto.getExperience();
        this.preferredGameplay = dto.getPreferredGameplay();
        this.accept = dto.isAccept();
        this.status = dto.getStatus() != null ? dto.getStatus() : "PENDING";
        this.comment = dto.getComment();
        this.createdAt = dto.getCreatedAt() != null ? dto.getCreatedAt() : Instant.now();
    }

    // --- Méthode pour mise à jour depuis un DTO ---
    public void updateFromDto(com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO dto) {
        this.username = dto.getUsername();
        this.discordTag = dto.getDiscordTag();
        this.motivation = dto.getMotivation();
        this.referral = dto.getReferral();
        this.experience = dto.getExperience();
        this.preferredGameplay = dto.getPreferredGameplay();
        this.accept = dto.isAccept();
        this.status = dto.getStatus() != null ? dto.getStatus() : "PENDING";
        this.comment = dto.getComment();
    }
}






