package com.icy.icy_backend.service.session;

import com.icy.icy_backend.controller.dto.session.SaleSuggestionDTO;
import com.icy.icy_backend.controller.dto.session.SessionSheetDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Suggestions de vente pour le reste à vendre d'une fiche (docs/mining-v3/SPEC.md, « Suggestions de vente ») :
 * 5 meilleurs points de vente par minerai, avec lieu, demande et date du relevé. Ce sont des estimations ;
 * seul le montant saisi à la vente compte dans le partage.
 */
@Service
@RequiredArgsConstructor
public class SessionSuggestionService {
    static final int POINTS_PER_COMMODITY = 5;

    private final SessionLoader loader;
    private final SessionSheetService sheetService;
    private final MiningMarketService market;

    @Transactional(readOnly = true)
    public SaleSuggestionDTO suggestions(UUID sheetId) {
        SessionSheetDTO sheet = sheetService.view(loader.read(sheetId));
        Map<Integer, List<MiningMarketService.SalePoint>> prices = market.salePoints();
        List<SaleSuggestionDTO.Commodity> commodities = new ArrayList<>();
        Map<Integer, List<String>> buyers = new LinkedHashMap<>();
        Map<Integer, MiningMarketService.Terminal> terminals = new LinkedHashMap<>();
        for (SessionSheetDTO.Remaining remaining : sheet.remaining()) {
            if (remaining.remainingCscu() <= 0) continue;
            List<MiningMarketService.SalePoint> points = prices.getOrDefault(remaining.commodityId(), List.of());
            for (MiningMarketService.SalePoint point : points) {
                buyers.computeIfAbsent(point.terminal().id(), key -> new ArrayList<>()).add(remaining.commodityName());
                terminals.putIfAbsent(point.terminal().id(), point.terminal());
            }
            List<SaleSuggestionDTO.Point> best = points.stream().limit(POINTS_PER_COMMODITY)
                    .map(point -> new SaleSuggestionDTO.Point(point.terminal().id(), point.terminal().name(), point.terminal().location(),
                            point.pricePerScu(), point.demandScu(), estimate(point, remaining.remainingCscu()), point.observedAt()))
                    .toList();
            commodities.add(new SaleSuggestionDTO.Commodity(remaining.commodityId(), remaining.commodityName(), remaining.remainingCscu(), best));
        }
        SaleSuggestionDTO.Stop stop = buyers.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .max(Comparator.comparingInt((Map.Entry<Integer, List<String>> entry) -> entry.getValue().size())
                        .thenComparing(entry -> -entry.getKey()))
                .map(entry -> {
                    MiningMarketService.Terminal terminal = terminals.get(entry.getKey());
                    return new SaleSuggestionDTO.Stop(terminal.id(), terminal.name(), terminal.location(), entry.getValue());
                }).orElse(null);
        return new SaleSuggestionDTO(commodities, stop, market.fetchedAt("commodities_prices"));
    }

    /** Prix × quantité restante, plafonnée par la demande quand la source la donne. Arrondi à l'aUEC inférieur. */
    static long estimate(MiningMarketService.SalePoint point, long remainingCscu) {
        long cscu = point.demandScu() == null ? remainingCscu : Math.min(remainingCscu, point.demandScu() * 100L);
        return point.pricePerScu() * cscu / 100;
    }
}
