package com.icy.icy_backend.service.session;

import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.service.session.SettlementCalculator.Member;
import com.icy.icy_backend.service.session.SettlementCalculator.Movement;
import com.icy.icy_backend.service.session.SettlementCalculator.Result;
import com.icy.icy_backend.service.session.SettlementCalculator.Row;
import com.icy.icy_backend.service.session.SettlementCalculator.Transfer;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Mêmes cas que docs/mining-v3/calcul.test.mjs, sur le calcul serveur qui fait foi. */
class SettlementCalculatorTest {
    private static final UUID ALEX = id(1);
    private static final UUID BEA = id(2);
    private static final UUID CID = id(3);
    private static final List<Member> ABC = List.of(new Member(ALEX, 100), new Member(BEA, 100), new Member(CID, 100));

    @Test
    void specExampleProfitTwoSellersAndHalfShare() {
        List<Member> people = List.of(new Member(ALEX, 100), new Member(BEA, 100), new Member(CID, 50));
        Result result = SettlementCalculator.settle(people,
                List.of(new Movement(ALEX, 50_000), new Movement(CID, 100_000)),
                List.of(new Movement(ALEX, 600_000), new Movement(BEA, 400_000)));

        assertInvariants(result, people);
        assertThat(result.rows()).extracting(Row::balance).containsExactly(390_000L, 340_000L, 270_000L);
        assertThat(result.transfers()).containsExactly(new Transfer(ALEX, CID, 210_000), new Transfer(BEA, CID, 60_000));
    }

    @Test
    void specExampleDeficitSharesTheLossEqually() {
        Result result = SettlementCalculator.settle(ABC, List.of(new Movement(ALEX, 150_000)), List.of(new Movement(BEA, 60_000)));

        assertInvariants(result, ABC);
        assertThat(result.rows()).extracting(Row::share).containsExactly(-30_000L, -30_000L, -30_000L);
        assertThat(result.transfers()).containsExactly(new Transfer(BEA, ALEX, 90_000), new Transfer(CID, ALEX, 30_000));
    }

    @Test
    void largestRemainderGivesTheExtraUnitToTheFirstArrivedOnTies() {
        assertThat(SettlementCalculator.allocateNet(100_000, ABC)).containsExactlyEntriesOf(ordered(ALEX, 33_334L, BEA, 33_333L, CID, 33_333L));
    }

    @Test
    void negativeNetUsesTheLowerIntegerPart() {
        assertThat(SettlementCalculator.allocateNet(-100_000, ABC)).containsExactlyEntriesOf(ordered(ALEX, -33_333L, BEA, -33_333L, CID, -33_334L));
    }

    @Test
    void largestRemainderWinsOverArrivalOrder() {
        UUID a = id(10);
        UUID b = id(11);
        // 10 aUEC pour 0,5 + 1 part : 3,33 et 6,67 exacts ; le reste de b (0,67) passe avant celui de a.
        assertThat(SettlementCalculator.allocateNet(10, List.of(new Member(a, 50), new Member(b, 100)))).containsEntry(a, 3L).containsEntry(b, 7L);
    }

    @Test
    void zeroShareMemberIsRefundedButNeverReceivesARoundingUnit() {
        UUID zero = id(20);
        List<Member> people = List.of(new Member(zero, 0), new Member(ALEX, 100), new Member(BEA, 100), new Member(CID, 100));
        Result result = SettlementCalculator.settle(people, List.of(new Movement(zero, 7)), List.of(new Movement(ALEX, 108)));

        assertInvariants(result, people);
        Row row = result.rows().getFirst();
        assertThat(row.share()).isZero();
        assertThat(row.balance()).isEqualTo(7);
    }

    @Test
    void refusesWhenNobodyHasAShare() {
        assertThatThrownBy(() -> SettlementCalculator.allocateNet(1_000, List.of(new Member(ALEX, 0))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void invariantsHoldOnRandomSessions() {
        Random random = new Random(42);
        int[] shareChoices = {0, 25, 50, 100, 100, 100, 150, 200};
        for (int run = 0; run < 5_000; run++) {
            int size = 1 + random.nextInt(9);
            List<Member> people = new ArrayList<>();
            for (int index = 0; index < size; index++) people.add(new Member(id(100 + index), shareChoices[random.nextInt(shareChoices.length)]));
            if (people.stream().allMatch(member -> member.sharesCenti() == 0)) people.set(0, new Member(people.getFirst().userId(), 100));
            List<Movement> expenses = new ArrayList<>();
            for (int index = random.nextInt(6); index > 0; index--) expenses.add(new Movement(people.get(random.nextInt(size)).userId(), 1 + random.nextInt(300_000)));
            List<Movement> sales = new ArrayList<>();
            for (int index = random.nextInt(5); index > 0; index--) sales.add(new Movement(people.get(random.nextInt(size)).userId(), 1 + random.nextInt(3_000_000)));
            assertInvariants(SettlementCalculator.settle(people, expenses, sales), people);
        }
    }

    private static void assertInvariants(Result result, List<Member> people) {
        assertThat(result.rows().stream().mapToLong(Row::share).sum()).as("somme des parts = net").isEqualTo(result.net());
        assertThat(result.rows().stream().mapToLong(Row::balance).sum()).as("somme des soldes = ventes").isEqualTo(result.totalSales());
        assertThat(result.rows().stream().mapToLong(Row::gap).sum()).as("somme des écarts = 0").isZero();
        assertThat(result.transfers().size()).as("au plus n − 1 versements").isLessThanOrEqualTo(Math.max(0, people.size() - 1));
        Map<UUID, Long> moved = new HashMap<>();
        for (Transfer transfer : result.transfers()) {
            assertThat(transfer.amount()).isPositive();
            moved.merge(transfer.fromUserId(), -transfer.amount(), Long::sum);
            moved.merge(transfer.toUserId(), transfer.amount(), Long::sum);
        }
        int totalCenti = people.stream().mapToInt(Member::sharesCenti).sum();
        for (Row row : result.rows()) {
            assertThat(moved.getOrDefault(row.userId(), 0L)).as("les versements soldent chaque membre").isEqualTo(row.gap());
            double exact = (double) result.net() * row.sharesCenti() / totalCenti;
            assertThat(Math.abs(row.share() - exact)).as("part à moins d'1 aUEC de l'exacte").isLessThan(1.0);
            if (row.sharesCenti() == 0) assertThat(row.share()).isZero();
        }
    }

    private static Map<UUID, Long> ordered(UUID a, long va, UUID b, long vb, UUID c, long vc) {
        Map<UUID, Long> map = new java.util.LinkedHashMap<>();
        map.put(a, va);
        map.put(b, vb);
        map.put(c, vc);
        return map;
    }

    private static UUID id(int value) {
        return new UUID(0, value);
    }
}
