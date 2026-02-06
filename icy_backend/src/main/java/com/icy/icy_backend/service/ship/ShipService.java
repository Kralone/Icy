package com.icy.icy_backend.service.ship;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ShipService {
    private static final Logger logger = LoggerFactory.getLogger(ShipService.class);
    private final ShipRepository shipRepository;
    private final BrandRepository brandRepository;
    private final MessageService messageService;
    private final NotificationPushService notificationPushService;

    public ShipService(ShipRepository shipRepository, BrandRepository brandRepository, MessageService messageService, NotificationPushService notificationPushService) {
        this.shipRepository = shipRepository;
        this.brandRepository = brandRepository;
        this.messageService = messageService;
        this.notificationPushService = notificationPushService;
    }

    public ResponseEntity<MessageResponse<List<Ship>>> getAllShips() {
        logger.info("Récupération de tous les vaisseaux");
        List<Ship> ships = shipRepository.findAll();
        return messageService.buildResponse("ship.found", ships);
    }

    public ResponseEntity<MessageResponse<Ship>> getShipByName(String name) {
        logger.info("Recherche du vaisseau avec le nom: {}", name);
        Ship ship = shipRepository.findByName(name).orElseThrow(() -> {
            logger.warn("Aucun vaisseau trouvé avec le nom: {}", name);
            return new ResourceNotFoundException("Aucun vaisseau trouvé avec le nom: " + name);
        });
        return messageService.buildResponse("ship.found", ship, ship.getName());
    }

    public ResponseEntity<MessageResponse<Ship>> createShip(Ship ship) {
        logger.info("Création d’un nouveau vaisseau : {}", ship.getName());

        // Vérifie que la marque existe
        Brand brand = brandRepository.findByName(ship.getBrand().getName())
                .orElseThrow(() -> new ResourceNotFoundException("Marque introuvable : " + ship.getBrand().getName()));

        ship.setBrand(brand);
        Ship savedShip = shipRepository.save(ship);
        notificationPushService.sendBroadcast(
                "Catalogue : nouveau vaisseau",
                savedShip.getName() + " est disponible.",
                "/icy/hangar",
                1
        );

        return messageService.buildResponse("ship.created", savedShip, savedShip.getName());
    }

    public ResponseEntity<MessageResponse<List<Ship>>> getShipsByBrand(String brandName) {
        logger.info("Récupération des vaisseaux pour la marque: {}", brandName);

        Brand brand = brandRepository.findByName(brandName)
                .orElseThrow(() -> new ResourceNotFoundException("Marque introuvable : " + brandName));

        List<Ship> ships = shipRepository.findByBrand(brand);
        return messageService.buildResponse("ship.found", ships);
    }

    public Ship findShipById(Long shipId) {
        return shipRepository.findById(shipId)
                .orElseThrow(() -> {
                    logger.warn("Vaisseau introuvable avec ID: {}", shipId);
                    return new ResourceNotFoundException("Aucun vaisseau trouvé avec l'ID: " + shipId);
                });
    }

}






