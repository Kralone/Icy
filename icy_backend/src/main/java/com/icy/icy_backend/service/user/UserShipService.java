package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserShipDTO;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.db.entity.user.id.UserShipId;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.ship.ShipService;
import com.icy.icy_backend.websocket.ShipFleetWebSocketService;
import com.icy.icy_backend.websocket.UserWebSocketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

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

    public ResponseEntity<MessageResponse<List<UserShip>>> getShipsByUserId(Object userIdentifier) {
        User user = userService.resolveUser(userIdentifier);
        UUID userId = user.getId();

        logger.info("Récupération des vaisseaux pour l'utilisateur ID: {}", userId);
        List<UserShip> userShips = userShipRepository.findByUserId(userId);

        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé pour l'utilisateur ID: {}", userId);
            return messageService.buildResponse("user.notfound", List.of(), "Aucun vaisseau trouvé pour l'utilisateur ID: " + userId);
        }

        logger.info("Nombre de vaisseaux trouvés: {}", userShips.size());
        return messageService.buildResponse("user.found", userShips);
    }

    public ResponseEntity<MessageResponse<UserShip>> addShipToUser(UUID userId, Long shipId, boolean isInGame, boolean isRewardInGame, boolean isLoaner) {


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
        userShip.setInGamePurchase(isInGame);
        userShip.setRewardInGame(isRewardInGame);
        userShip.setLoaner(isLoaner);
        if (userShip.getCreatedAt() == null) {
            userShip.setCreatedAt(java.time.LocalDateTime.now());
        }


        userShipRepository.save(userShip);
        logger.info("Vaisseau ID: {} ajouté avec succès à l'utilisateur: {}", shipId, user.getUsername());

        userWebSocketService.sendUserShipUpdate(userShip);
        shipFleetWebSocketService.sendShipFleetUpdate(this.getFleetSummaryAsList());

        return messageService.buildResponse("user.ship.add.success", userShip);
    }

    public List<FleetSummaryResponse> getFleetSummaryAsList() {
        logger.info("Génération du résumé de la flotte");

        List<UserShip> userShips = userShipRepository.findAllWithShips();
        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé.");
            return List.of();
        }

        List<FleetSummaryResponse> fleetSummary = new ArrayList<>();
        for (UserShip userShip : userShips) {
            Ship ship = userShip.getShip();

            fleetSummary.add(new FleetSummaryResponse(
                    ship.getName(),
                    ship.getImageUrl(),
                    ship.getFocus(),
                    ship.getBrand() != null ? ship.getBrand().getImageUrl() : null
            ));
        }

        return fleetSummary;
    }

    public ResponseEntity<MessageResponse<List<FleetSummaryResponse>>> getFleetSummary() {
        List<FleetSummaryResponse> summary = getFleetSummaryAsList();
        return messageService.buildResponse("ship.fleet.summary", summary);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> deleteShipFromUser(Object userIdentifier, Long shipId) {
        User user = userService.resolveUser(userIdentifier);
        UUID userId = user.getId();

        logger.info("Suppression du vaisseau ID: {} pour l'utilisateur ID: {}", shipId, userId);

        userShipRepository.deleteByUserIdAndShipId(userId, shipId);

        logger.info("Vaisseau ID: {} supprimé pour l'utilisateur ID: {}", shipId, userId);
        UserShip deletedShip = new UserShip();
        deletedShip.setUser(user);
        deletedShip.setShip(shipService.findShipById(shipId));
        deletedShip.setInGamePurchase(false);
        deletedShip.setRewardInGame(false);
        deletedShip.setLoaner(false);
        deletedShip.setCreatedAt(java.time.LocalDateTime.now());
        userWebSocketService.sendUserShipDeletion(deletedShip);
        shipFleetWebSocketService.sendShipFleetUpdate(this.getFleetSummaryAsList());
        return messageService.buildResponse("user.ship.delete.success", null, "Vaisseau supprimé avec succès.");
    }

    public List<UserShipDTO> getShipsByUserIdDTO(UUID userId) {
        List<UserShip> userShips = userShipRepository.findByUserIdWithShipAndBrand(userId); // méthode custom avec JOIN FETCH
        return userShips.stream()
                .map(UserShipDTO::from)
                .toList();
    }

}





