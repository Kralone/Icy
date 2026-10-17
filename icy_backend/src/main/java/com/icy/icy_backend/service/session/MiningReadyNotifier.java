package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.repository.session.MiningRefineryOrderRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Annonce sur Discord les ordres de raffinage devenus prêts, une seule fois chacun.
 * Une heure de fin modifiée remet l'annonce à faire (ready_notified_at remis à null par le service).
 * Quand le dernier ordre d'une fiche devient prêt, un message mentionne tous les lanceurs qui ont encore un ordre à remettre.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MiningReadyNotifier {
    private final MiningRefineryOrderRepository orders;
    private final SessionSheetRepository sheets;
    private final SessionSheetService sheetService;
    private final MiningNotifications notifications;
    private final SessionEvents events;

    @Scheduled(initialDelayString = "${iceforge.mining.ready-check-ms:30000}", fixedDelayString = "${iceforge.mining.ready-check-ms:30000}")
    @Transactional
    public void announceReadyOrders() {
        LocalDateTime now = sheetService.now();
        List<MiningRefineryOrder> ready = orders.findReadyToAnnounce(now);
        if (ready.isEmpty()) return;
        Map<UUID, List<MiningRefineryOrder>> bySheet = ready.stream()
                .collect(Collectors.groupingBy(MiningRefineryOrder::getSheetId, LinkedHashMap::new, Collectors.toList()));
        for (Map.Entry<UUID, List<MiningRefineryOrder>> entry : bySheet.entrySet()) {
            SessionSheet sheet = sheets.findById(entry.getKey()).orElse(null);
            if (sheet == null) continue;
            for (MiningRefineryOrder order : entry.getValue()) {
                order.setReadyNotifiedAt(now);
                notifications.orderReady(sheet, order);
            }
            List<MiningRefineryOrder> all = orders.findBySheetWithLines(sheet.getId());
            if (all.stream().allMatch(order -> order.isReady(now)) && all.size() > 1) notifications.allReady(sheet, all);
            // L'étape affichée change (prêt) : les fiches ouvertes se relisent.
            events.changed(sheet.getId());
        }
        log.info("{} ordre(s) de raffinage annoncé(s) prêt(s)", ready.size());
    }
}
