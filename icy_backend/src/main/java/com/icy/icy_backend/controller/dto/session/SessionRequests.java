package com.icy.icy_backend.controller.dto.session;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Corps des requêtes de l'API des fiches de session (/api/sessions). */
public final class SessionRequests {
    private SessionRequests() {
    }

    /** activity : MINING (par défaut) ou SALVAGE. */
    public record CreateSheet(String name, LocalDate sessionDate, List<UUID> participantIds, String activity) {
    }

    public record UpdateSheet(String name, LocalDate sessionDate) {
    }

    /** sharesCenti : 100 = 1 part, 50 = demi-part, 0 = exclu du partage. */
    public record Participant(UUID userId, Integer sharesCenti) {
    }

    public record Participants(List<Participant> participants) {
    }

    /** payerUserId : réservé à l'organisateur ; un participant déclare toujours ses propres frais. */
    public record Expense(UUID payerUserId, String kind, Long amount, String note) {
    }

    public record OrderLine(Integer commodityId, Integer quantityCscu, Integer quality, String destination) {
    }

    /**
     * Lot de cargo. kind : REFINERY (par défaut) ou HAUL (cargaison de salvage, fiches de salvage seulement).
     * REFINERY : remainingMinutes est la durée restante affichée par la raffinerie au lancement, d'où l'heure de fin ;
     * à la modification, null garde l'heure de fin déjà enregistrée.
     * HAUL : ni raffinerie, ni méthode, ni durée ; locationLabel dit où se trouve le cargo (vaisseau, station).
     */
    public record RefineryOrder(UUID launcherUserId, String kind, Integer terminalId, String locationLabel, String methodCode, Long cost,
                                Integer remainingMinutes, UUID recipientUserId, List<OrderLine> lines) {
    }

    public record SaleLine(Integer commodityId, Integer quantityCscu) {
    }

    /** terminalLabel ne sert que si le terminal n'est pas dans la liste UEX. */
    public record Sale(UUID sellerUserId, Integer terminalId, String terminalLabel, Long amount, List<SaleLine> lines) {
    }

    public record Reason(String reason) {
    }

    /** target : SETTLEMENT (corriger une confirmation) ou ACTIVE (corriger un frais, une vente ou une part). */
    public record Reopen(String target, String reason) {
    }
}
