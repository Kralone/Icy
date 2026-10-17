package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.session.SessionHistory;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSettlementTransfer;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.UUID;

import static com.icy.icy_backend.service.session.SessionFixture.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;

/** Arrêt des comptes, confirmations, clôtures et réouvertures (docs/mining-v3/SPEC.md, « Déroulé de la fiche »). */
class SessionSettlementServiceTest {
    private final SessionFixture fixture = new SessionFixture();

    /** Kralone a vendu 1 200 000 ; Torin a avancé 60 000 de frais : Kralone doit verser à Vexa et à Torin. */
    @BeforeEach
    void session() {
        fixture.order(TORIN, KRALONE, 1_480, true);
        fixture.sale(KRALONE, 1_200_000, 1_480);
        fixture.expense(TORIN, 60_000);
    }

    @AfterEach
    void close() {
        fixture.close();
    }

    @Test
    void settlingSnapshotsBalancesAndTransfers() {
        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());

        SessionSettlement settlement = fixture.current();
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.SETTLEMENT);
        assertThat(settlement.getNet()).isEqualTo(1_140_000);
        assertThat(settlement.getShares()).extracting(s -> s.getShare()).containsExactly(380_000L, 380_000L, 380_000L);
        assertThat(settlement.getTransfers()).extracting(SessionSettlementTransfer::getFromUserId).containsOnly(KRALONE);
        assertThat(settlement.getTransfers()).extracting(SessionSettlementTransfer::getAmount).containsExactlyInAnyOrder(440_000L, 380_000L);
        Mockito.verify(fixture.notifications).settled(fixture.sheet, settlement);
    }

    @Test
    void onlyTheOrganizerSettles() {
        assertThatThrownBy(() -> fixture.as(VEXA).settlementService.settle(fixture.sheet.getId())).isInstanceOf(ForbiddenException.class);
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.ACTIVE);
    }

    @Test
    void sheetClosesNormallyAtTheMomentTheLastReceiptIsConfirmed() {
        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());
        SessionSettlementTransfer toVexa = transferTo(VEXA);
        SessionSettlementTransfer toTorin = transferTo(TORIN);

        fixture.as(VEXA).settlementService.confirmReceipt(fixture.sheet.getId(), toVexa.getId());
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.SETTLEMENT);

        fixture.as(TORIN).settlementService.confirmReceipt(fixture.sheet.getId(), toTorin.getId());
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.CLOSED);
        assertThat(fixture.current().getCloseKind()).isEqualTo(SessionSettlement.CloseKind.NORMAL);
        assertThat(toTorin.getReceivedByUserId()).isEqualTo(TORIN);
    }

    @Test
    void onlyTheReceiverOrTheOrganizerConfirms() {
        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());
        SessionSettlementTransfer toTorin = transferTo(TORIN);

        assertThatThrownBy(() -> fixture.as(VEXA).settlementService.confirmReceipt(fixture.sheet.getId(), toTorin.getId())).isInstanceOf(ForbiddenException.class);
        fixture.as(KRALONE).settlementService.confirmReceipt(fixture.sheet.getId(), toTorin.getId());
        assertThat(toTorin.getReceivedByUserId()).isEqualTo(KRALONE);
    }

    @Test
    void reopeningAClosedSheetForAConfirmationDoesNotCloseItAgainByItself() {
        closeNormally();

        fixture.as(KRALONE).settlementService.reopen(fixture.sheet.getId(), "SETTLEMENT", "Confirmation cochée par erreur");

        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.SETTLEMENT);
        assertThat(fixture.current().getCloseKind()).isNull();
        assertThat(fixture.current().allReceived()).isTrue();

        fixture.as(VEXA).settlementService.withdrawReceipt(fixture.sheet.getId(), transferTo(VEXA).getId());
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.SETTLEMENT);
        fixture.settlementService.confirmReceipt(fixture.sheet.getId(), transferTo(VEXA).getId());
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.CLOSED);
    }

    @Test
    void forcedCloseKeepsUnconfirmedTransfersAndRequiresAReason() {
        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());
        fixture.as(VEXA).settlementService.confirmReceipt(fixture.sheet.getId(), transferTo(VEXA).getId());

        assertThatThrownBy(() -> fixture.as(KRALONE).settlementService.forceClose(fixture.sheet.getId(), " ")).isInstanceOf(BadRequestException.class);
        fixture.settlementService.forceClose(fixture.sheet.getId(), "Torin absent cette semaine");

        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.CLOSED);
        assertThat(fixture.current().getCloseKind()).isEqualTo(SessionSettlement.CloseKind.FORCED);
        assertThat(transferTo(TORIN).getReceivedAt()).isNull();
        assertThat(transferTo(VEXA).getReceivedAt()).isNotNull();
    }

    @Test
    void reopeningForEditsCancelsTheSettlementButKeepsIt() {
        closeNormally();
        SessionSettlement first = fixture.current();

        fixture.as(KRALONE).settlementService.reopen(fixture.sheet.getId(), "ACTIVE", "Vente oubliée");

        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.ACTIVE);
        assertThat(first.getCancelledAt()).isNotNull();
        assertThat(first.getTransfers()).allSatisfy(t -> assertThat(t.getReceivedAt()).isNotNull());
        Mockito.verify(fixture.settlementRepository, Mockito.never()).delete(any());

        fixture.settlementService.settle(fixture.sheet.getId());
        assertThat(fixture.settlements).hasSize(2);
        assertThat(fixture.current()).isNotSameAs(first);
        assertThat(fixture.current().getTransfers()).allSatisfy(t -> assertThat(t.getReceivedAt()).isNull());
    }

    @Test
    void reopeningRequiresAReasonAndTheOrganizer() {
        closeNormally();

        assertThatThrownBy(() -> fixture.as(VEXA).settlementService.reopen(fixture.sheet.getId(), "ACTIVE", "x")).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> fixture.as(KRALONE).settlementService.reopen(fixture.sheet.getId(), "ACTIVE", "")).isInstanceOf(BadRequestException.class);
    }

    @Test
    void everyTransitionIsRecordedInTheHistory() {
        closeNormally();
        fixture.as(KRALONE).settlementService.reopen(fixture.sheet.getId(), "ACTIVE", "Vente oubliée");

        ArgumentCaptor<SessionHistory> captor = ArgumentCaptor.forClass(SessionHistory.class);
        Mockito.verify(fixture.historyRepository, Mockito.atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(SessionHistory::getAction).containsSubsequence(
                SessionHistory.Action.SETTLED, SessionHistory.Action.CLOSED, SessionHistory.Action.REOPENED_ACTIVE);
        assertThat(captor.getAllValues().getLast().getReason()).isEqualTo("Vente oubliée");
    }

    @Test
    void settlementWithoutTransfersClosesImmediately() {
        fixture.sales.clear();
        fixture.expenses.clear();
        fixture.orders.clear();

        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());

        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.CLOSED);
        assertThat(fixture.current().getCloseKind()).isEqualTo(SessionSettlement.CloseKind.NORMAL);
    }

    private void closeNormally() {
        fixture.as(KRALONE).settlementService.settle(fixture.sheet.getId());
        for (SessionSettlementTransfer transfer : fixture.current().getTransfers()) {
            UUID receiver = transfer.getToUserId();
            fixture.as(receiver).settlementService.confirmReceipt(fixture.sheet.getId(), transfer.getId());
        }
        assertThat(fixture.sheet.getStatus()).isEqualTo(SessionSheet.Status.CLOSED);
    }

    private SessionSettlementTransfer transferTo(UUID receiver) {
        return fixture.current().getTransfers().stream().filter(t -> t.getToUserId().equals(receiver)).findFirst().orElseThrow();
    }
}
