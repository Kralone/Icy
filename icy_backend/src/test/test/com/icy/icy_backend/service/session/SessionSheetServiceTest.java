package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SessionRequests;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.icy.icy_backend.service.session.SessionFixture.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Droits, stock et remise côté serveur (docs/mining-v3/SPEC.md, « Droits » et « Stock de chaque vendeur »). */
class SessionSheetServiceTest {
    private final SessionFixture fixture = new SessionFixture();

    @AfterEach
    void close() {
        fixture.close();
    }

    // ----- Droits -----

    @Test
    void participantDeclaresOwnExpense() {
        fixture.as(VEXA).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "FUEL", 8_400L, "Plein"));

        assertThat(fixture.expenses).singleElement().satisfies(expense -> {
            assertThat(expense.getPayerUserId()).isEqualTo(VEXA);
            assertThat(expense.getAmount()).isEqualTo(8_400L);
        });
    }

    @Test
    void participantCannotDeclareAnExpenseForSomeoneElse() {
        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(TORIN, "FUEL", 100L, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThat(fixture.expenses).isEmpty();
    }

    @Test
    void organizerDeclaresAnExpenseForAParticipant() {
        fixture.as(KRALONE).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(TORIN, "REPAIR", 25_000L, null));

        assertThat(fixture.expenses).singleElement().extracting(e -> e.getPayerUserId()).isEqualTo(TORIN);
    }

    @Test
    void officerHasOrganizerRightsOnAnySheet() {
        fixture.as(XENO, "OFFICIER").sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(TORIN, "FUEL", 100L, null));

        assertThat(fixture.expenses).hasSize(1);
    }

    @Test
    void nonParticipantCannotWrite() {
        assertThatThrownBy(() -> fixture.as(XENO).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "FUEL", 100L, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void participantCannotEditSomeoneElsesExpense() {
        fixture.expense(TORIN, 500L);
        var expense = fixture.expenses.getFirst();

        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.deleteExpense(fixture.sheet.getId(), expense.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void writesAreRefusedOnceAccountsAreSettled() {
        fixture.sheet.setStatus(SessionSheet.Status.SETTLEMENT);

        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "FUEL", 100L, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void onlySpecialistsOfficersAndAdminsCreateASheet() {
        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.create(new SessionRequests.CreateSheet("Session", null, List.of())))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void zeroAmountIsRefused() {
        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addExpense(fixture.sheet.getId(), new SessionRequests.Expense(null, "FUEL", 0L, null)))
                .isInstanceOf(BadRequestException.class);
    }

    // ----- Ordres -----

    @Test
    void orderRequiresQualityOnEveryLine() {
        SessionRequests.RefineryOrder request = new SessionRequests.RefineryOrder(null, REFINERY, null, 12_000L, 90, null,
                List.of(new SessionRequests.OrderLine(LARANITE, 1_480, null, "SELL")));

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(), request)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void orderStoresItsFinishTimeFromTheRemainingDuration() {
        fixture.as(TORIN).sheetService.addOrder(fixture.sheet.getId(), new SessionRequests.RefineryOrder(null, REFINERY, null, 12_000L, 90, VEXA,
                List.of(new SessionRequests.OrderLine(LARANITE, 1_480, 701, "SELL"))));

        assertThat(fixture.orders).singleElement().satisfies(order -> {
            assertThat(order.getFinishesAt()).isEqualTo(NOW.plusMinutes(90));
            assertThat(order.getRecipientUserId()).isEqualTo(VEXA);
            assertThat(order.isHandedOver()).isFalse();
        });
    }

    // ----- Remise et stock -----

    @Test
    void ownOrderIsNotSellableUntilTheLauncherConfirmsPickingItUp() {
        MiningRefineryOrder own = fixture.order(KRALONE, KRALONE, 1_840, false);
        SessionRequests.Sale sale = new SessionRequests.Sale(null, null, "Area18 TDD", 500_000L, List.of(new SessionRequests.SaleLine(LARANITE, 1_000)));

        assertThatThrownBy(() -> fixture.as(KRALONE).sheetService.addSale(fixture.sheet.getId(), sale)).isInstanceOf(BadRequestException.class);

        fixture.sheetService.handOver(fixture.sheet.getId(), own.getId(), true);
        fixture.sheetService.addSale(fixture.sheet.getId(), sale);
        assertThat(fixture.sales).hasSize(1);
    }

    @Test
    void saleLinesOfTheSameCommodityAreCumulatedAgainstTheStock() {
        fixture.order(TORIN, VEXA, 100, true);
        SessionRequests.Sale tooMuch = new SessionRequests.Sale(null, null, "Lorville", 1_000L,
                List.of(new SessionRequests.SaleLine(LARANITE, 70), new SessionRequests.SaleLine(LARANITE, 70)));

        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.addSale(fixture.sheet.getId(), tooMuch)).isInstanceOf(BadRequestException.class);
        assertThat(fixture.sales).isEmpty();

        fixture.sheetService.addSale(fixture.sheet.getId(), new SessionRequests.Sale(null, null, "Lorville", 1_000L,
                List.of(new SessionRequests.SaleLine(LARANITE, 50), new SessionRequests.SaleLine(LARANITE, 50))));
        assertThat(fixture.sales).hasSize(1);
    }

    @Test
    void partialSaleLeavesTheRestInStock() {
        fixture.order(TORIN, VEXA, 1_480, true);
        fixture.as(VEXA).sheetService.addSale(fixture.sheet.getId(), new SessionRequests.Sale(null, null, "Lorville", 100_000L,
                List.of(new SessionRequests.SaleLine(LARANITE, 1_000))));

        assertThat(MiningStock.stockOf(VEXA, fixture.orders, fixture.sales)).containsEntry(LARANITE, 480L);
        assertThatThrownBy(() -> fixture.sheetService.addSale(fixture.sheet.getId(), new SessionRequests.Sale(null, null, "Area18", 1L,
                List.of(new SessionRequests.SaleLine(LARANITE, 481))))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void stockIsSeparateForEachSeller() {
        fixture.order(TORIN, VEXA, 1_480, true);

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.addSale(fixture.sheet.getId(), new SessionRequests.Sale(null, null, "Area18", 1L,
                List.of(new SessionRequests.SaleLine(LARANITE, 1)))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void unrelatedParticipantCannotMarkAnOrderHandedOver() {
        MiningRefineryOrder order = fixture.order(KRALONE, VEXA, 1_000, false);

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.handOver(fixture.sheet.getId(), order.getId(), true)).isInstanceOf(ForbiddenException.class);
        fixture.as(VEXA).sheetService.handOver(fixture.sheet.getId(), order.getId(), true);
        assertThat(order.isHandedOver()).isTrue();
    }

    @Test
    void handoverCannotBeCancelledOnceTheOreIsSold() {
        MiningRefineryOrder order = fixture.order(TORIN, VEXA, 1_000, true);
        fixture.sale(VEXA, 50_000, 600);

        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.handOver(fixture.sheet.getId(), order.getId(), false)).isInstanceOf(BadRequestException.class);
        assertThat(order.isHandedOver()).isTrue();
    }

    @Test
    void orderChangeThatWouldRemoveSoldOreIsRefused() {
        MiningRefineryOrder order = fixture.order(TORIN, VEXA, 1_000, true);
        fixture.sale(VEXA, 50_000, 600);
        SessionRequests.RefineryOrder smaller = new SessionRequests.RefineryOrder(null, REFINERY, null, 0L, null, VEXA,
                List.of(new SessionRequests.OrderLine(LARANITE, 500, 700, "SELL")));

        assertThatThrownBy(() -> fixture.as(TORIN).sheetService.updateOrder(fixture.sheet.getId(), order.getId(), smaller)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void participantWithEntriesCannotBeRemovedButCanGetZeroShare() {
        fixture.expense(TORIN, 100L);
        List<SessionRequests.Participant> withoutTorin = List.of(new SessionRequests.Participant(KRALONE, 100), new SessionRequests.Participant(VEXA, 100));

        assertThatThrownBy(() -> fixture.as(KRALONE).sheetService.setParticipants(fixture.sheet.getId(), new SessionRequests.Participants(withoutTorin)))
                .isInstanceOf(BadRequestException.class);

        fixture.sheetService.setParticipants(fixture.sheet.getId(), new SessionRequests.Participants(List.of(
                new SessionRequests.Participant(KRALONE, 100), new SessionRequests.Participant(VEXA, 100), new SessionRequests.Participant(TORIN, 0))));
        assertThat(fixture.participants).filteredOn(p -> p.getUserId().equals(TORIN)).singleElement().extracting(p -> p.getSharesCenti()).isEqualTo(0);
    }

    // ----- Lien avec les Opérations -----

    @Test
    void operationSheetIsCreatedOnceWithEveryPresentMember() {
        java.util.UUID operationId = java.util.UUID.randomUUID();
        org.mockito.Mockito.when(fixture.sheets.findByOperationEventId(operationId)).thenReturn(java.util.Optional.empty());
        org.mockito.Mockito.when(fixture.sheets.save(org.mockito.ArgumentMatchers.any(SessionSheet.class))).thenAnswer(invocation -> {
            SessionSheet created = invocation.getArgument(0);
            if (created.getId() == null) created.setId(java.util.UUID.randomUUID());
            return created;
        });
        fixture.participants.clear();

        java.util.UUID created = fixture.as(KRALONE).sheetService.ensureForOperation(operationId, "Quanta du jeudi", java.time.LocalDate.of(2026, 10, 22), KRALONE, List.of(VEXA, TORIN));

        assertThat(created).isNotNull();
        assertThat(fixture.participants).extracting(p -> p.getUserId()).containsExactly(VEXA, TORIN);
        assertThat(fixture.participants).allSatisfy(p -> assertThat(p.getSharesCenti()).isEqualTo(100));
    }

    @Test
    void existingOperationSheetIsReturnedInsteadOfASecondOne() {
        java.util.UUID operationId = java.util.UUID.randomUUID();
        org.mockito.Mockito.when(fixture.sheets.findByOperationEventId(operationId)).thenReturn(java.util.Optional.of(fixture.sheet));

        assertThat(fixture.as(KRALONE).sheetService.ensureForOperation(operationId, "x", java.time.LocalDate.now(), KRALONE, List.of(XENO)))
                .isEqualTo(fixture.sheet.getId());
        org.mockito.Mockito.verify(fixture.participantRepository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void onlyTheOrganizerManagesParticipants() {
        assertThatThrownBy(() -> fixture.as(VEXA).sheetService.setParticipants(fixture.sheet.getId(),
                new SessionRequests.Participants(List.of(new SessionRequests.Participant(VEXA, 100)))))
                .isInstanceOf(ForbiddenException.class);
    }
}
