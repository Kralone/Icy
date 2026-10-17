package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SessionSheetDTO;
import com.icy.icy_backend.db.entity.session.SessionHistory;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSettlementShare;
import com.icy.icy_backend.db.entity.session.SessionSettlementTransfer;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.session.SessionParticipant;
import com.icy.icy_backend.db.repository.session.SessionHistoryRepository;
import com.icy.icy_backend.db.repository.session.SessionSettlementRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Arrêt des comptes, confirmations de versement, clôture et réouverture (docs/mining-v3/SPEC.md, « Déroulé de la fiche »).
 *
 * <ul>
 *   <li>Arrêter les comptes crée un règlement : photographie des soldes et des versements.</li>
 *   <li>La clôture normale a lieu au moment où une confirmation rend tous les versements reçus ; jamais du seul fait d'être en SETTLEMENT.</li>
 *   <li>La clôture forcée demande un motif et reste marquée FORCED.</li>
 *   <li>Rouvrir vers ACTIVE annule le règlement sans l'effacer.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SessionSettlementService {
    private final SessionSheetRepository sheets;
    private final SessionSettlementRepository settlements;
    private final SessionHistoryRepository history;
    private final SessionLoader loader;
    private final SessionSheetService sheetService;
    private final SessionEvents events;
    private final MiningNotifications notifications;

    @Transactional
    public SessionSheetDTO settle(UUID sheetId) {
        SessionData data = loader.lock(sheetId);
        UUID actor = SessionAccess.currentUserId();
        SessionAccess.requireOrganizer(data.sheet(), actor);
        SessionAccess.requireStatus(data.sheet(), SessionSheet.Status.ACTIVE, "Les comptes sont déjà arrêtés.");
        if (data.participants().stream().mapToInt(SessionParticipant::getSharesCenti).sum() <= 0) {
            throw new BadRequestException("Il faut au moins une part non nulle pour arrêter les comptes.");
        }
        SettlementCalculator.Result result = data.preview();
        LocalDateTime now = sheetService.now();
        SessionSettlement settlement = SessionSettlement.builder().sheetId(sheetId).createdAt(now).createdByUserId(actor)
                .totalSales(result.totalSales()).totalExpenses(result.totalExpenses()).net(result.net()).build();
        int position = 0;
        for (SettlementCalculator.Row row : result.rows()) {
            settlement.getShares().add(SessionSettlementShare.builder().settlement(settlement).userId(row.userId()).sharesCenti(row.sharesCenti())
                    .share(row.share()).advanced(row.advanced()).cashed(row.cashed()).balance(row.balance()).position(position++).build());
        }
        position = 0;
        for (SettlementCalculator.Transfer transfer : result.transfers()) {
            settlement.getTransfers().add(SessionSettlementTransfer.builder().settlement(settlement).fromUserId(transfer.fromUserId())
                    .toUserId(transfer.toUserId()).amount(transfer.amount()).position(position++).build());
        }
        SessionSheet sheet = data.sheet();
        sheet.setStatus(SessionSheet.Status.SETTLEMENT);
        record(sheetId, actor, SessionHistory.Action.SETTLED, null, now);
        // Aucun versement à faire : rien à confirmer, la fiche est soldée tout de suite.
        if (settlement.getTransfers().isEmpty()) close(sheet, settlement, SessionSettlement.CloseKind.NORMAL, null, actor, now);
        settlements.save(settlement);
        notifications.settled(sheet, settlement);
        return saved(sheet, now);
    }

    @Transactional
    public SessionSheetDTO confirmReceipt(UUID sheetId, UUID transferId) {
        Context context = settlementContext(sheetId, transferId);
        SessionSettlementTransfer transfer = context.transfer();
        if (transfer.getReceivedAt() != null) throw new BadRequestException("Ce versement est déjà confirmé.");
        LocalDateTime now = sheetService.now();
        transfer.setReceivedAt(now);
        transfer.setReceivedByUserId(context.actor());
        String onBehalf = context.actor().equals(transfer.getToUserId()) ? null : "Confirmé par l’organisateur au nom du receveur.";
        record(sheetId, context.actor(), SessionHistory.Action.RECEIPT_CONFIRMED, onBehalf, now);
        // C'est cette confirmation qui clôt la fiche, si elle était la dernière attendue.
        if (context.settlement().allReceived()) close(context.data().sheet(), context.settlement(), SessionSettlement.CloseKind.NORMAL, null, context.actor(), now);
        settlements.save(context.settlement());
        return saved(context.data().sheet(), now);
    }

    @Transactional
    public SessionSheetDTO withdrawReceipt(UUID sheetId, UUID transferId) {
        Context context = settlementContext(sheetId, transferId);
        SessionSettlementTransfer transfer = context.transfer();
        if (transfer.getReceivedAt() == null) throw new BadRequestException("Ce versement n’est pas confirmé.");
        transfer.setReceivedAt(null);
        transfer.setReceivedByUserId(null);
        LocalDateTime now = sheetService.now();
        record(sheetId, context.actor(), SessionHistory.Action.RECEIPT_WITHDRAWN, null, now);
        settlements.save(context.settlement());
        return saved(context.data().sheet(), now);
    }

    @Transactional
    public SessionSheetDTO forceClose(UUID sheetId, String reason) {
        SessionData data = loader.lock(sheetId);
        UUID actor = SessionAccess.currentUserId();
        SessionAccess.requireOrganizer(data.sheet(), actor);
        SessionAccess.requireStatus(data.sheet(), SessionSheet.Status.SETTLEMENT, "Seule une fiche aux comptes arrêtés peut être clôturée.");
        String motive = requiredReason(reason);
        SessionSettlement settlement = data.settlement().orElseThrow(SessionSettlementService::missingSettlement);
        LocalDateTime now = sheetService.now();
        SessionSettlement.CloseKind kind = settlement.allReceived() ? SessionSettlement.CloseKind.NORMAL : SessionSettlement.CloseKind.FORCED;
        close(data.sheet(), settlement, kind, motive, actor, now);
        settlements.save(settlement);
        return saved(data.sheet(), now);
    }

    /**
     * target SETTLEMENT : depuis CLOSED, pour corriger une confirmation ; le règlement reste le même et la fiche
     * attend une nouvelle confirmation ou une clôture forcée, sans se refermer d'elle-même.
     * target ACTIVE : depuis SETTLEMENT ou CLOSED ; le règlement est annulé, conservé dans l'historique.
     */
    @Transactional
    public SessionSheetDTO reopen(UUID sheetId, String target, String reason) {
        SessionData data = loader.lock(sheetId);
        UUID actor = SessionAccess.currentUserId();
        SessionSheet sheet = data.sheet();
        SessionAccess.requireOrganizer(sheet, actor);
        String motive = requiredReason(reason);
        SessionSettlement settlement = data.settlement().orElseThrow(SessionSettlementService::missingSettlement);
        LocalDateTime now = sheetService.now();
        String wanted = target == null ? "" : target.trim().toUpperCase();
        if ("SETTLEMENT".equals(wanted)) {
            SessionAccess.requireStatus(sheet, SessionSheet.Status.CLOSED, "Seule une fiche terminée revient aux versements.");
            settlement.setClosedAt(null);
            settlement.setCloseKind(null);
            settlement.setCloseReason(null);
            sheet.setStatus(SessionSheet.Status.SETTLEMENT);
            record(sheetId, actor, SessionHistory.Action.REOPENED_SETTLEMENT, motive, now);
        } else if ("ACTIVE".equals(wanted)) {
            if (sheet.getStatus() == SessionSheet.Status.ACTIVE) throw new BadRequestException("La fiche est déjà en cours.");
            settlement.setCancelledAt(now);
            settlement.setCancelledByUserId(actor);
            sheet.setStatus(SessionSheet.Status.ACTIVE);
            record(sheetId, actor, SessionHistory.Action.REOPENED_ACTIVE, motive, now);
        } else {
            throw new BadRequestException("Réouverture invalide : choisissez les versements ou la saisie.");
        }
        settlements.save(settlement);
        notifications.reopened(sheet, wanted, motive, data.participants().stream().map(SessionParticipant::getUserId).toList());
        return saved(sheet, now);
    }

    private record Context(SessionData data, SessionSettlement settlement, SessionSettlementTransfer transfer, UUID actor) {
    }

    /** Confirmer ou retirer une confirmation : fiche en SETTLEMENT, receveur ou organisateur (tracé). */
    private Context settlementContext(UUID sheetId, UUID transferId) {
        SessionData data = loader.lock(sheetId);
        UUID actor = SessionAccess.currentUserId();
        SessionAccess.requireStatus(data.sheet(), SessionSheet.Status.SETTLEMENT, "Les versements ne se confirment qu’une fois les comptes arrêtés et avant la clôture.");
        SessionSettlement settlement = data.settlement().orElseThrow(SessionSettlementService::missingSettlement);
        SessionSettlementTransfer transfer = settlement.getTransfers().stream().filter(t -> t.getId().equals(transferId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Versement introuvable sur cette fiche."));
        if (!actor.equals(transfer.getToUserId()) && !SessionAccess.isOrganizer(data.sheet(), actor)) {
            throw new ForbiddenException("Seul le receveur confirme un versement.");
        }
        return new Context(data, settlement, transfer, actor);
    }

    private void close(SessionSheet sheet, SessionSettlement settlement, SessionSettlement.CloseKind kind, String reason, UUID actor, LocalDateTime now) {
        settlement.setClosedAt(now);
        settlement.setCloseKind(kind);
        settlement.setCloseReason(reason);
        sheet.setStatus(SessionSheet.Status.CLOSED);
        record(sheet.getId(), actor, kind == SessionSettlement.CloseKind.FORCED ? SessionHistory.Action.FORCED_CLOSE : SessionHistory.Action.CLOSED, reason, now);
    }

    private void record(UUID sheetId, UUID actor, SessionHistory.Action action, String reason, LocalDateTime now) {
        history.save(SessionHistory.builder().sheetId(sheetId).actorUserId(actor).action(action).reason(reason).at(now).build());
    }

    private SessionSheetDTO saved(SessionSheet sheet, LocalDateTime now) {
        sheet.touch(now);
        sheets.save(sheet);
        events.changed(sheet.getId());
        return sheetService.view(loader.read(sheet.getId()));
    }

    private static String requiredReason(String reason) {
        String motive = SessionSheetService.text(reason, 500);
        if (motive == null) throw new BadRequestException("Indiquez un motif.");
        return motive;
    }

    private static BadRequestException missingSettlement() {
        return new BadRequestException("Aucun règlement en cours sur cette fiche.");
    }
}
