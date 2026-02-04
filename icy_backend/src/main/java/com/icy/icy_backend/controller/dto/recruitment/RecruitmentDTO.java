package com.icy.icy_backend.controller.dto.recruitment;

import com.icy.icy_backend.db.entity.recruitment.Recruitment;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecruitmentDTO {
    private Long id;
    private String username;
    private String discordTag;
    private String motivation;
    private String referral;
    private String experience;
    private String preferredGameplay;
    private boolean accept;
    private String status;
    private String comment;
    private Instant createdAt;

    // --- Constructeur depuis une entité ---
    public RecruitmentDTO(Recruitment entity) {
        this.id = entity.getId();
        this.username = entity.getUsername();
        this.discordTag = entity.getDiscordTag();
        this.motivation = entity.getMotivation();
        this.referral = entity.getReferral();
        this.experience = entity.getExperience();
        this.preferredGameplay = entity.getPreferredGameplay();
        this.accept = entity.isAccept();
        this.status = entity.getStatus();
        this.comment = entity.getComment();
        this.createdAt = entity.getCreatedAt();
    }
}






