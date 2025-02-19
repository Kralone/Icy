package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.AddUserShip;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.UserShip;
import com.icy.icy_backend.db.entity.id.UserShipId;
import com.icy.icy_backend.db.repository.UserShipRepository;
import com.icy.icy_backend.service.rest.MessageService;
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

    public UserShipService(UserShipRepository userShipRepository, MessageService messageService, UserService userService, ShipService shipService) {
        this.userShipRepository = userShipRepository;
        this.messageService = messageService;
        this.userService = userService;
        this.shipService = shipService;
    }

    public ResponseEntity<MessageResponse<List<Ship>>> getShipsByUserId(Long discordId) {
        logger.info("Récupération des vaisseaux pour l'utilisateur ID: {}", discordId);
        List<Ship> userShips = userShipRepository.findShipsByUserDiscordId(discordId);
        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé pour l'utilisateur ID: {}", discordId);
            return messageService.buildResponse("user.notfound", List.of(), "Aucun vaisseau trouvé pour l'utilisateur ID: " + discordId);
        }

        logger.info("Nombre de vaisseaux trouvés: {}", userShips.size());
        return messageService.buildResponse("user.found", userShips);
    }

    public ResponseEntity<MessageResponse<UserShip>> addShipToUser(AddUserShip addUserShipDto) {
        Long discordId = addUserShipDto.getDiscordId();
        Long shipId = addUserShipDto.getShipId();

        logger.info("Ajout d'un vaisseau pour l'utilisateur Discord ID: {}, Vaisseau ID: {}", discordId, shipId);

        // Récupérer l'utilisateur via UserService
        User user = userService.findUserByDiscordId(discordId);

        // Récupérer le vaisseau via ShipService
        Ship ship = shipService.findShipById(shipId);

        // Vérifier si l'utilisateur possède déjà ce vaisseau
        boolean exists = userShipRepository.existsByUserIdAndShipId(user.getId(), shipId);
        if (exists) {
            logger.warn("L'utilisateur Discord ID: {} possède déjà le vaisseau ID: {}", discordId, shipId);
            return messageService.buildResponse("user.ship.already.exists", null,
                    "L'utilisateur possède déjà ce vaisseau.");
        }

        // Création et sauvegarde du lien User-Ship
        UserShip userShip = new UserShip();
        userShip.setUser(user);
        userShip.setShip(ship);
        userShip.setId(new UserShipId(user.getId(), ship.getId()));

        userShipRepository.save(userShip);
        logger.info("Vaisseau ID: {} ajouté avec succès à l'utilisateur Discord ID: {}", shipId, discordId);

        return messageService.buildResponse("user.ship.add.success", userShip);
    }

    public ResponseEntity<MessageResponse<Map<String, List<String>>>> getFleetSummary() {
        logger.info("Génération du résumé de la flotte");

        List<UserShip> userShips = userShipRepository.findAll();
        if (userShips.isEmpty()) {
            logger.warn("Aucun vaisseau trouvé.");
            return messageService.buildResponse("ship.notfound", Map.of(), "Aucun vaisseau enregistré.");
        }

        Map<String, List<String>> fleetSummary = new HashMap<>();

        for (UserShip userShip : userShips) {
            Ship ship = userShip.getShip();
            String focus = ship.getFocus() != null ? ship.getFocus().replace("Starter, ", "") : "Autre";
            String shipNameDisplay = ship.getName();

            fleetSummary.computeIfAbsent(focus, k -> new ArrayList<>()).add(shipNameDisplay);
        }

        return messageService.buildResponse("ship.fleet.summary", fleetSummary);
    }


    @Transactional
    public ResponseEntity<MessageResponse<Void>> deleteShipFromUser(Long discordId, Long shipId) {
        logger.info("Suppression du vaisseau ID: {} pour l'utilisateur Discord ID: {}", shipId, discordId);

        // Récupérer l'utilisateur via son Discord ID
        UUID userId = userService.findUserByDiscordId(discordId).getId();

        // Suppression directe via le repository
        userShipRepository.deleteByUserIdAndShipId(userId, shipId);

        logger.info("Vaisseau ID: {} supprimé pour l'utilisateur ID: {}", shipId, userId);
        return messageService.buildResponse("user.ship.delete.success", null, "Vaisseau supprimé avec succès.");
    }


}
