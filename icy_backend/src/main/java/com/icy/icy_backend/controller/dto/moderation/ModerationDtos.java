package com.icy.icy_backend.controller.dto.moderation;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class ModerationDtos {
    private ModerationDtos() {
    }

    /**
     * Vue d'ensemble pour la page Membres : avertissements en cours de chaque membre actif qui en a,
     * et exclusions dont le ban Discord reste à faire à la main.
     */
    public record Summary(int threshold, List<Standing> members, List<BanTask> discordBansToDo) {
    }

    /** pendingDecision : le membre a atteint le seuil et aucun Directeur n'a encore tranché depuis son dernier avertissement. */
    public record Standing(UUID userId, long activeWarnings, LocalDateTime lastWarningAt, boolean pendingDecision) {
    }

    public record BanTask(Long sanctionId, UUID userId, String username, String discordId,
                          String decidedByName, LocalDateTime decidedAt) {
    }

    /**
     * Dossier disciplinaire d'un membre. canWarn : le membre connecté peut l'avertir ou lever ses avertissements ;
     * canDecide : il peut trancher au seuil et confirmer un ban Discord (Directeur).
     */
    public record Record(UUID userId, String username, String discordId, boolean active, int threshold,
                         long activeWarnings, boolean pendingDecision, boolean canWarn, boolean canDecide,
                         List<Warning> warnings, List<Sanction> sanctions) {
    }

    /** dmStatus : PENDING, SENT ou FAILED ; dmFailure précise un refus (dm_closed, user_not_found…). */
    public record Warning(Long id, String category, String reason, int rank, String issuedByName, LocalDateTime createdAt,
                          boolean active, LocalDateTime revokedAt, String revokedByName, String revokeReason,
                          String dmStatus, String dmFailure) {
    }

    /** decision : EXCLUDE ou KEEP. dmStatus est null quand le membre n'a pas été prévenu. */
    public record Sanction(Long id, String decision, String note, String decidedByName, LocalDateTime createdAt,
                           LocalDateTime discordBanDoneAt, String discordBanDoneBy, String dmStatus, String dmFailure) {
    }

    public record WarningRequest(String category, String reason) {
    }

    /** notifyMember : prévenir le membre par message privé que l'avertissement est levé. */
    public record RevokeRequest(String reason, Boolean notifyMember) {
    }

    /** decision : EXCLUDE ou KEEP ; notifyMember : prévenir le membre par message privé. */
    public record DecisionRequest(String decision, String note, Boolean notifyMember) {
    }
}
