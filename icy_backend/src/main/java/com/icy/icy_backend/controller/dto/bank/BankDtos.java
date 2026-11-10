package com.icy.icy_backend.controller.dto.bank;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Corps et réponses de l'API de la banque de guilde (/api/bank). Montants en aUEC. */
public final class BankDtos {
    private BankDtos() {
    }

    // ----- Requêtes -----

    /** kind : DEPOSIT, EXPENSE, PAYOUT ou ADJUSTMENT. occurredOn vide : aujourd'hui. */
    public record EntryRequest(String kind, Long amount, UUID userId, UUID projectId, String note, LocalDate occurredOn) {
    }

    public record CancelRequest(String reason) {
    }

    /** status : OPEN, COMPLETED ou CANCELLED ; ignoré à la création. */
    public record ProjectRequest(String name, String description, Long targetAmount, Long shipId, String status) {
    }

    // ----- Réponses -----

    /** Ce que le lecteur peut faire : voir le détail du journal, saisir des mouvements. */
    public record Access(boolean details, boolean write) {
    }

    public record Totals(long balance, long deposits, long expenses, long payouts, long adjustments, int donors, int entries) {
    }

    /** Un mois du graphique : entrées, sorties, ajustements à la hausse et à la baisse (positifs), solde en fin de mois. */
    public record MonthPoint(String month, long deposits, long expenses, long payouts, long adjustmentsIn, long adjustmentsOut, long balance) {
    }

    /** Solde après les mouvements d'un jour. */
    public record BalancePoint(LocalDate date, long balance) {
    }

    public record Project(UUID id, String name, String description, Long targetAmount, String status,
                          Long shipId, String shipName, String shipImageUrl,
                          long collected, long spent, long paidOut, long available, int contributors,
                          LocalDateTime createdAt) {
    }

    /** Mouvement tel qu'un membre sans accès le voit : ni joueur, ni note, ni auteur. */
    public record PublicEntry(UUID id, String kind, long amount, UUID projectId, String projectName, LocalDate occurredOn) {
    }

    public record Entry(UUID id, String kind, long amount, long signedAmount,
                        UUID userId, String userName, String userAvatarUrl,
                        UUID projectId, String projectName, String note, LocalDate occurredOn,
                        UUID recordedBy, String recordedByName, LocalDateTime recordedAt,
                        boolean cancelled, LocalDateTime cancelledAt, String cancelledByName, String cancelReason) {
    }

    /** Ce que le lecteur a lui-même donné et reçu. */
    public record Mine(long given, long received, List<Entry> entries) {
    }

    public record Player(UUID userId, String userName, String userAvatarUrl, long given, long received, int deposits, LocalDate lastDeposit) {
    }

    public record Overview(Access access, Totals totals, List<MonthPoint> months, List<BalancePoint> balanceCurve,
                           List<Project> projects, List<PublicEntry> recent, Mine mine) {
    }

    /** Membre actif proposé à la saisie d'un dépôt ou d'un reversement. */
    public record Member(UUID id, String name) {
    }

    public record Details(List<Entry> entries, List<Player> players) {
    }
}
