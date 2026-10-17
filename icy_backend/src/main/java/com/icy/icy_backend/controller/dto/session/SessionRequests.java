package com.icy.icy_backend.controller.dto.session;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Corps des requêtes de l'API des fiches de session (/api/sessions). */
public final class SessionRequests {
    private SessionRequests() {
    }

    public record CreateSheet(String name, LocalDate sessionDate, List<UUID> participantIds) {
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
     * remainingMinutes : durée restante affichée par la raffinerie au lancement, d'où l'heure de fin.
     * À la modification, null garde l'heure de fin déjà enregistrée.
     */
    public record RefineryOrder(UUID launcherUserId, Integer terminalId, String methodCode, Long cost, Integer remainingMinutes,
                                UUID recipientUserId, List<OrderLine> lines) {
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
