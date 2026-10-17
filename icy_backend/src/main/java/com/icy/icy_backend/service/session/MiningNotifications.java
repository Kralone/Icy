package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.mining.MiningRefineryOrderLine;
import com.icy.icy_backend.db.entity.session.SessionSettlement;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Messages Discord des fiches de minage, publiés dans le salon des notifications (celui des SC World Events).
 * Le texte est rédigé ici ; le bot ajoute les mentions et le lien vers la fiche (chemin relatif « path »).
 */
@Component
@RequiredArgsConstructor
public class MiningNotifications {
    public static final String ORDER_READY = "mining.order_ready";
    public static final String ALL_READY = "mining.all_ready";
    public static final String SETTLED = "mining.settled";
    public static final String REOPENED = "mining.reopened";

    private final UserRepository users;
    private final SessionEvents events;

    public void orderReady(SessionSheet sheet, MiningRefineryOrder order) {
        Map<UUID, User> people = people(List.of(order.getLauncherUserId(), order.getRecipientUserId()));
        boolean own = order.getLauncherUserId().equals(order.getRecipientUserId());
        String description = "Ton raffinage à " + order.getTerminalLabel() + " est prêt : " + ores(order) + ".";
        String next = own ? "Récupère-le, puis marque-le récupéré sur la fiche avant de le vendre."
                : "À remettre à " + name(people, order.getRecipientUserId()) + ".";
        send(ORDER_READY, sheet, "Raffinage prêt · " + sheet.getName(), description + " " + next, List.of(),
                mentions(people, List.of(order.getLauncherUserId())));
    }

    /** Dernier ordre prêt : mention de tous les lanceurs dont un ordre attend encore sa remise. */
    public void allReady(SessionSheet sheet, Collection<MiningRefineryOrder> orders) {
        List<MiningRefineryOrder> waiting = orders.stream().filter(order -> !order.isHandedOver()).toList();
        if (waiting.isEmpty()) return;
        Map<UUID, User> people = people(waiting.stream().flatMap(o -> List.of(o.getLauncherUserId(), o.getRecipientUserId()).stream()).toList());
        List<String> lines = waiting.stream()
                .map(o -> name(people, o.getLauncherUserId()) + " : " + o.getTerminalLabel() + " → " + name(people, o.getRecipientUserId()))
                .toList();
        send(ALL_READY, sheet, "Tous les raffinages sont prêts · " + sheet.getName(),
                "Récupérez vos ordres et remettez-les à leur vendeur.", lines,
                mentions(people, waiting.stream().map(MiningRefineryOrder::getLauncherUserId).toList()));
    }

    public void settled(SessionSheet sheet, SessionSettlement settlement) {
        List<UUID> ids = new ArrayList<>();
        settlement.getTransfers().forEach(t -> { ids.add(t.getFromUserId()); ids.add(t.getToUserId()); });
        Map<UUID, User> people = people(ids);
        List<String> lines = settlement.getTransfers().stream()
                .map(t -> name(people, t.getFromUserId()) + " verse " + amount(t.getAmount()) + " aUEC à " + name(people, t.getToUserId()))
                .toList();
        String description = lines.isEmpty() ? "Aucun versement n'est nécessaire." : "Faites vos versements en jeu ; chaque receveur confirme sur la fiche.";
        send(SETTLED, sheet, "Comptes arrêtés · " + sheet.getName(), description, lines,
                mentions(people, settlement.getTransfers().stream().map(t -> t.getFromUserId()).toList()));
    }

    public void reopened(SessionSheet sheet, String target, String reason, Collection<UUID> participantIds) {
        Map<UUID, User> people = people(participantIds);
        String what = "ACTIVE".equals(target)
                ? "La fiche est rouverte pour correction : les versements seront recalculés et les confirmations refaites."
                : "La fiche est rouverte pour corriger une confirmation de versement.";
        send(REOPENED, sheet, "Fiche rouverte · " + sheet.getName(), what, reason == null ? List.of() : List.of("Motif : " + reason),
                mentions(people, participantIds));
    }

    private void send(String key, SessionSheet sheet, String title, String description, List<String> lines, List<String> mentionIds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sheetId", sheet.getId());
        payload.put("sheetName", sheet.getName());
        payload.put("path", "/icy/outils/fiches-minage/" + sheet.getId());
        payload.put("title", title);
        payload.put("description", description);
        payload.put("lines", lines);
        payload.put("mentionDiscordIds", mentionIds);
        events.notifyDiscord(key, payload);
    }

    private Map<UUID, User> people(Collection<UUID> ids) {
        Set<UUID> unique = new LinkedHashSet<>(ids);
        unique.remove(null);
        return users.findAllById(unique).stream().collect(Collectors.toMap(User::getId, user -> user));
    }

    private static List<String> mentions(Map<UUID, User> people, Collection<UUID> ids) {
        return new LinkedHashSet<>(ids).stream().map(people::get)
                .filter(user -> user != null && user.getDiscordId() != null && user.getDiscordId().matches("\\d{5,25}"))
                .map(User::getDiscordId).toList();
    }

    private static String name(Map<UUID, User> people, UUID id) {
        User user = people.get(id);
        return user == null ? "un membre" : user.getUsername();
    }

    static String ores(MiningRefineryOrder order) {
        List<String> parts = order.getLines().stream()
                .filter(line -> line.getDestination() == MiningRefineryOrderLine.Destination.SELL)
                .map(line -> scu(line.getQuantityCscu()) + " SCU de " + line.getCommodityName())
                .toList();
        long kept = order.getLines().stream().filter(line -> line.getDestination() == MiningRefineryOrderLine.Destination.KEEP).count();
        String sold = parts.isEmpty() ? "aucun minerai à vendre" : String.join(", ", parts);
        return kept == 0 ? sold : sold + " (et " + kept + " minerai" + (kept > 1 ? "s" : "") + " conservé" + (kept > 1 ? "s" : "") + ")";
    }

    static String scu(int cscu) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.FRANCE);
        format.setMaximumFractionDigits(2);
        return format.format(cscu / 100.0).replace(' ', ' ').replace(' ', ' ');
    }

    static String amount(long value) {
        return NumberFormat.getIntegerInstance(Locale.FRANCE).format(value).replace(' ', ' ').replace(' ', ' ');
    }
}
