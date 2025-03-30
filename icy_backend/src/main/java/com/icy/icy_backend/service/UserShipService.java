package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.UserShip;
import com.icy.icy_backend.db.entity.id.UserShipId;
import com.icy.icy_backend.db.repository.UserShipRepository;
import com.icy.icy_backend.service.rest.MessageService;
import com.icy.icy_backend.websocket.ShipFleetWebSocketService;
import com.icy.icy_backend.websocket.UserWebSocketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class UserShipService {
    private static final Logger logger = LoggerFactory.getLogger(UserShipService.class);
    private final UserShipRepository userShipRepository;
    private final MessageService messageService;
    private final UserService userService;
    private final ShipService shipService;
    private final UserWebSocketService userWebSocketService;
    private final ShipFleetWebSocketService shipFleetWebSocketService;

    public UserShipService(UserShipRepository userShipRepository, MessageService messageService,
                           UserService userService, ShipService shipService,
                           UserWebSocketService userWebSocketService, ShipFleetWebSocketService shipFleetWebSocketService) {
        this.userShipRepository = userShipRepository;
        this.messageService = messageService;
        this.userService = userService;
        this.shipService = shipService;
        this.userWebSocketService = userWebSocketService;
        this.shipFleetWebSocketService = shipFleetWebSocketService;
    }

    public ResponseEntity<MessageResponse<List<Ship>>> getShipsByUserId(Object userIdentifier) {
        User user = userService.resolveUser(userIdentifier);
        UUID userId = user.getId();

        logger.info("Récupération des vaisseaux pour l'utilisateur ID: {}", userId);
        List<Ship> userShips = userShipRepository.findShipsByUserId(userId);

        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé pour l'utilisateur ID: {}", userId);
            return messageService.buildResponse("user.notfound", List.of(), "Aucun vaisseau trouvé pour l'utilisateur ID: " + userId);
        }

        logger.info("Nombre de vaisseaux trouvés: {}", userShips.size());
        return messageService.buildResponse("user.found", userShips);
    }

    public ResponseEntity<MessageResponse<UserShip>> addShipToUser(UUID userId, Long shipId) {


        Ship ship = shipService.findShipById(shipId);
        User user = userService.findUserById(userId);

        logger.info("Ajout d'un vaisseau pour l'utilisateur : {}, Vaisseau ID: {}", user.getUsername(), shipId);
        boolean exists = userShipRepository.existsByUserIdAndShipId(user.getId(), shipId);
        if (exists) {
            logger.warn("L'utilisateur : {} possède déjà le vaisseau ID: {}", user.getUsername(), shipId);
            return messageService.buildResponse("user.ship.already.exists", null,
                    "L'utilisateur possède déjà ce vaisseau.");
        }

        UserShip userShip = new UserShip();
        userShip.setUser(user);
        userShip.setShip(ship);
        userShip.setId(new UserShipId(user.getId(), ship.getId()));

        userShipRepository.save(userShip);
        logger.info("Vaisseau ID: {} ajouté avec succès à l'utilisateur: {}", shipId, user.getUsername());

        userWebSocketService.sendUserShipUpdate(userShip);
        shipFleetWebSocketService.sendShipFleetUpdate(this.getFleetSummaryAsMap());

        return messageService.buildResponse("user.ship.add.success", userShip);
    }

    public ResponseEntity<MessageResponse<Map<String, List<String>>>> getFleetSummary() {
        Map<String, List<String>> fleet = getFleetSummaryAsMap();
        if(fleet == null) {
            return messageService.buildResponse("ship.notfound", Map.of(), "Aucun vaisseau enregistré.");
        }

        return messageService.buildResponse("ship.fleet.summary", fleet);
    }

    public Map<String, List<String>> getFleetSummaryAsMap() {
        logger.info("Génération du résumé de la flotte");

        List<UserShip> userShips = userShipRepository.findAllWithShips();
        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé.");
            return null;
        }

        Map<String, List<String>> fleetSummary = new HashMap<>();

        for (UserShip userShip : userShips) {
            Ship ship = userShip.getShip();
            String focus = ship.getFocus() != null ? ship.getFocus().replace("Starter, ", "") : "Autre";
            String shipNameDisplay = ship.getName();

            fleetSummary.computeIfAbsent(focus, k -> new ArrayList<>()).add(shipNameDisplay);
        }
        return fleetSummary;
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> deleteShipFromUser(Object userIdentifier, Long shipId) {
        User user = userService.resolveUser(userIdentifier);
        UUID userId = user.getId();

        logger.info("Suppression du vaisseau ID: {} pour l'utilisateur ID: {}", shipId, userId);

        userShipRepository.deleteByUserIdAndShipId(userId, shipId);

        logger.info("Vaisseau ID: {} supprimé pour l'utilisateur ID: {}", shipId, userId);
        userWebSocketService.sendUserShipDeletion(new UserShip(null, user, shipService.findShipById(shipId)));
        shipFleetWebSocketService.sendShipFleetUpdate(this.getFleetSummaryAsMap());
        return messageService.buildResponse("user.ship.delete.success", null, "Vaisseau supprimé avec succès.");
    }
}