package com.icy.icy_backend.controller.dto.session;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Fiche complète, avec tout ce qui est calculé par le serveur : étape, stocks, reste à vendre, partage et versements.
 * Le client n'a aucun calcul financier à refaire.
 */
public record SessionSheetDTO(
        UUID id,
        String name,
        LocalDate sessionDate,
        String status,
        String phase,
        long revision,
        UserRef organizer,
        UUID operationEventId,
        String operationTitle,
        Permissions permissions,
        List<Participant> participants,
        List<Expense> expenses,
        List<Order> orders,
        List<Sale> sales,
        List<Stock> stock,
        List<Remaining> remaining,
        Share share,
        List<History> history,
        List<CancelledSettlement> cancelledSettlements,
        LocalDateTime lastOrderFinishesAt,
        LocalDateTime serverTime
) {
    public record UserRef(UUID id, String username, String avatarUrl) {
    }

    /** Ce que le lecteur peut faire : l'interface masque le reste, le serveur le refuse de toute façon. */
    public record Permissions(UUID currentUserId, boolean organizer, boolean participant, boolean canEdit) {
    }

    public record Participant(UserRef user, int sharesCenti, LocalDateTime joinedAt, boolean seller) {
    }

    public record Expense(UUID id, UserRef payer, String kind, long amount, String note, LocalDateTime createdAt, boolean editable) {
    }

    public record OrderLine(int commodityId, String commodityName, int quantityCscu, int quality, String destination) {
    }

    public record Order(UUID id, UserRef launcher, Integer terminalId, String terminalLabel, String methodCode, String methodLabel,
                        long cost, LocalDateTime finishesAt, boolean ready, UserRef recipient, LocalDateTime handedOverAt,
                        List<OrderLine> lines, boolean editable, boolean canHandOver) {
    }

    public record SaleLine(int commodityId, String commodityName, int quantityCscu) {
    }

    public record Sale(UUID id, UserRef seller, Integer terminalId, String terminalLabel, long amount, LocalDateTime soldAt,
                       List<SaleLine> lines, boolean editable) {
    }

    /** inStockCscu : remis au vendeur et pas encore vendu. awaitingCscu : destiné au vendeur, pas encore remis. */
    public record StockLine(int commodityId, String commodityName, long inStockCscu, long awaitingCscu) {
    }

    public record Stock(UserRef seller, List<StockLine> lines) {
    }

    public record Remaining(int commodityId, String commodityName, long totalCscu, long soldCscu, long remainingCscu) {
    }

    public record ShareRow(UserRef user, int sharesCenti, long share, long advanced, long cashed, long balance, long gap) {
    }

    public record Transfer(UUID id, UserRef from, UserRef to, long amount, LocalDateTime receivedAt, UserRef receivedBy) {
    }

    /**
     * source : NONE avant la première vente (aucun solde affiché, il ferait apparaître un faux déficit),
     * PREVIEW tant que la fiche est en cours, SETTLEMENT une fois les comptes arrêtés.
     */
    public record Share(String source, long totalSales, long totalExpenses, long net, int totalSharesCenti,
                       List<ShareRow> rows, List<Transfer> transfers, Settlement settlement) {
    }

    public record Settlement(UUID id, LocalDateTime createdAt, UserRef createdBy, LocalDateTime closedAt, String closeKind, String closeReason) {
    }

    public record History(String action, UserRef actor, String reason, LocalDateTime at) {
    }

    public record CancelledSettlement(UUID id, LocalDateTime createdAt, LocalDateTime cancelledAt, UserRef cancelledBy, long totalSales,
                                      long totalExpenses, long net, List<Transfer> transfers) {
    }
}
