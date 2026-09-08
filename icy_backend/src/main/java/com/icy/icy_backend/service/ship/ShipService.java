package com.icy.icy_backend.service.ship;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ShipService {
    private static final Logger logger = LoggerFactory.getLogger(ShipService.class);
    private static final String CATALOG_MANAGED_MESSAGE =
            "Le catalogue des vaisseaux est synchronisé automatiquement.";
    private final ShipRepository shipRepository;
    private final BrandRepository brandRepository;
    private final MessageService messageService;

    public ShipService(ShipRepository shipRepository, BrandRepository brandRepository, MessageService messageService) {
        this.shipRepository = shipRepository;
        this.brandRepository = brandRepository;
        this.messageService = messageService;
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
        throw catalogManagedException();
    }

    public ResponseEntity<MessageResponse<Ship>> updateShip(Long shipId, Ship payload) {
        throw catalogManagedException();
    }

    public ResponseEntity<MessageResponse<String>> deleteShip(Long shipId) {
        throw catalogManagedException();
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

    private ResponseStatusException catalogManagedException() {
        return new ResponseStatusException(HttpStatus.GONE, CATALOG_MANAGED_MESSAGE);
    }

}






