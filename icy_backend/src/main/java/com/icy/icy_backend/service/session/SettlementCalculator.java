package com.icy.icy_backend.service.session;

import com.icy.icy_backend.exception.definition.BadRequestException;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Partage d'une session (docs/mining-v3/SPEC.md, « Règle de partage »), en aUEC entiers et sans virgule flottante.
 *
 * <pre>
 * net     = ventes − frais avancés
 * part    = net × centièmes du membre ÷ total des centièmes, arrondie par plus grand reste
 * solde   = part + frais avancés par le membre
 * écart   = solde − montant qu'il a encaissé en vendant
 * </pre>
 *
 * Invariants : somme des parts = net, somme des soldes = ventes, somme des écarts = 0.
 */
public final class SettlementCalculator {
    private SettlementCalculator() {
    }

    /** Membre dans l'ordre d'arrivée dans la fiche : cet ordre départage les restes égaux. */
    public record Member(UUID userId, int sharesCenti) {
    }

    /** Frais avancé ou vente encaissée par un membre. */
    public record Movement(UUID userId, long amount) {
    }

    public record Row(UUID userId, int sharesCenti, long share, long advanced, long cashed, long balance, long gap) {
    }

    public record Transfer(UUID fromUserId, UUID toUserId, long amount) {
    }

    public record Result(long totalSales, long totalExpenses, long net, List<Row> rows, List<Transfer> transfers) {
    }

    public static Result settle(List<Member> members, List<Movement> expenses, List<Movement> sales) {
        long totalSales = sum(sales);
        long totalExpenses = sum(expenses);
        long net = Math.subtractExact(totalSales, totalExpenses);
        Map<UUID, Long> shares = allocateNet(net, members);
        Map<UUID, Long> advanced = byUser(expenses);
        Map<UUID, Long> cashed = byUser(sales);
        List<Row> rows = new ArrayList<>();
        for (Member member : members) {
            long share = shares.get(member.userId());
            long memberAdvanced = advanced.getOrDefault(member.userId(), 0L);
            long memberCashed = cashed.getOrDefault(member.userId(), 0L);
            long balance = Math.addExact(share, memberAdvanced);
            rows.add(new Row(member.userId(), member.sharesCenti(), share, memberAdvanced, memberCashed, balance, Math.subtractExact(balance, memberCashed)));
        }
        Map<UUID, Long> gaps = new LinkedHashMap<>();
        rows.forEach(row -> gaps.put(row.userId(), row.gap()));
        List<UUID> order = members.stream().map(Member::userId).toList();
        return new Result(totalSales, totalExpenses, net, rows, planTransfers(gaps, order));
    }

    /**
     * Méthode du plus grand reste : partie entière inférieure de chaque part exacte (aussi pour un net négatif),
     * puis 1 aUEC à chacun des plus grands restes jusqu'à retomber sur le net. Les membres à 0 part n'en reçoivent jamais.
     */
    public static Map<UUID, Long> allocateNet(long net, List<Member> members) {
        BigInteger total = members.stream().map(member -> BigInteger.valueOf(member.sharesCenti())).reduce(BigInteger.ZERO, BigInteger::add);
        if (total.signum() <= 0) throw new BadRequestException("Il faut au moins une part non nulle pour partager.");
        record Slot(UUID userId, int order, int centi, BigInteger floor, BigInteger remainder) {
        }
        BigInteger exactNet = BigInteger.valueOf(net);
        List<Slot> slots = new ArrayList<>();
        BigInteger allocated = BigInteger.ZERO;
        for (int index = 0; index < members.size(); index++) {
            Member member = members.get(index);
            if (member.sharesCenti() < 0) throw new BadRequestException("Une part ne peut pas être négative.");
            BigInteger[] division = exactNet.multiply(BigInteger.valueOf(member.sharesCenti())).divideAndRemainder(total);
            BigInteger floor = division[0];
            BigInteger remainder = division[1];
            if (remainder.signum() < 0) {
                floor = floor.subtract(BigInteger.ONE);
                remainder = remainder.add(total);
            }
            slots.add(new Slot(member.userId(), index, member.sharesCenti(), floor, remainder));
            allocated = allocated.add(floor);
        }
        long gap = exactNet.subtract(allocated).longValueExact();
        List<Slot> byRemainder = slots.stream()
                .filter(slot -> slot.centi() > 0)
                .sorted(Comparator.comparing(Slot::remainder).reversed().thenComparingInt(Slot::order))
                .toList();
        Map<UUID, Long> result = new LinkedHashMap<>();
        slots.forEach(slot -> result.put(slot.userId(), slot.floor().longValueExact()));
        for (int index = 0; index < gap; index++) {
            UUID userId = byRemainder.get(index).userId();
            result.put(userId, result.get(userId) + 1);
        }
        return result;
    }

    /**
     * Le plus gros payeur verse au plus gros receveur le minimum des deux montants, jusqu'à tout solder.
     * Égalités départagées par l'ordre d'arrivée. Au plus « membres − 1 » versements.
     */
    public static List<Transfer> planTransfers(Map<UUID, Long> gaps, List<UUID> order) {
        record Balance(UUID userId, int order, long[] left) {
        }
        Map<UUID, Integer> position = new HashMap<>();
        for (int index = 0; index < order.size(); index++) position.put(order.get(index), index);
        List<Balance> payers = new ArrayList<>();
        List<Balance> receivers = new ArrayList<>();
        gaps.forEach((userId, gap) -> {
            int rank = position.getOrDefault(userId, Integer.MAX_VALUE);
            if (gap < 0) payers.add(new Balance(userId, rank, new long[]{-gap}));
            else if (gap > 0) receivers.add(new Balance(userId, rank, new long[]{gap}));
        });
        Comparator<Balance> largestFirst = Comparator.comparingLong((Balance balance) -> balance.left()[0]).reversed()
                .thenComparingInt(Balance::order);
        List<Transfer> transfers = new ArrayList<>();
        while (true) {
            Balance payer = payers.stream().filter(balance -> balance.left()[0] > 0).min(largestFirst).orElse(null);
            Balance receiver = receivers.stream().filter(balance -> balance.left()[0] > 0).min(largestFirst).orElse(null);
            if (payer == null || receiver == null) break;
            long amount = Math.min(payer.left()[0], receiver.left()[0]);
            transfers.add(new Transfer(payer.userId(), receiver.userId(), amount));
            payer.left()[0] -= amount;
            receiver.left()[0] -= amount;
        }
        return transfers;
    }

    private static long sum(List<Movement> movements) {
        long total = 0;
        for (Movement movement : movements) total = Math.addExact(total, movement.amount());
        return total;
    }

    private static Map<UUID, Long> byUser(List<Movement> movements) {
        Map<UUID, Long> totals = new HashMap<>();
        for (Movement movement : movements) totals.merge(movement.userId(), movement.amount(), Math::addExact);
        return totals;
    }
}
