package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;

@Service
public class WikeloService {
    private final WikeloShipRepository repository;
    private final WikeloShipRecipeScraper scraper;
    private final MessageService messageService;

    public WikeloService(WikeloShipRepository repository, WikeloShipRecipeScraper scraper,
                         MessageService messageService) {
        this.repository = repository;
        this.scraper = scraper;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<WikeloShip>>> getShips() {
        return messageService.buildResponse("wikelo.ships.found", repository.findAllByOrderByShipNameAsc());
    }

    @Transactional
    public ResponseEntity<MessageResponse<List<WikeloShip>>> rescrapeShips() {
        List<WikeloShip> ships = publishScrapedShips(scrapeShips());
        return messageService.buildResponse("wikelo.ships.scraped", ships, ships.size());
    }

    @Transactional
    public List<WikeloShip> publishScrapedShips(List<WikeloShip> ships) {
        validate(ships);
        repository.deleteAllInBatch();
        List<WikeloShip> saved = repository.saveAll(ships);
        saved.sort(Comparator.comparing(WikeloShip::getShipName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(WikeloShip::getMissionId));
        return saved;
    }

    public List<WikeloShip> scrapeShips() { return scraper.scrape(); }

    static void validate(List<WikeloShip> ships) {
        if (ships == null || ships.isEmpty())
            throw new IllegalStateException("Aucune offre Wikelo API ; les données publiées sont conservées.");
        var identities = new HashSet<String>();
        for (WikeloShip ship : ships) {
            if (ship == null || blank(ship.getShipName()) || blank(ship.getCostText())
                    || blank(ship.getMissionId()) || blank(ship.getRewardUuid()) || blank(ship.getSourceVersion())
                    || blank(ship.getSourceUrl()) || ship.getScrapedAt() == null
                    || !identities.add(ship.getMissionId() + ":" + ship.getRewardUuid()))
                throw new IllegalStateException("Offres Wikelo API incomplètes ou dupliquées ; publication conservée.");
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
