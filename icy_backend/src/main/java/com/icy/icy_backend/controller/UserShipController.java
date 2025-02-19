package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.AddUserShip;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.UserShip;
import com.icy.icy_backend.service.UserShipService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/user-ships")
public class UserShipController {
    private static final Logger logger = LoggerFactory.getLogger(UserShipController.class);
    private final UserShipService userShipService;

    public UserShipController(UserShipService userShipService) {
        this.userShipService = userShipService;
    }

    @GetMapping
    public ResponseEntity<MessageResponse<List<Ship>>> getUserShips(@RequestParam Long discordId) {
        logger.debug("Requête reçue : récupération des vaisseaux pour l'utilisateur ID : {}", discordId);
        return userShipService.getShipsByUserId(discordId);
    }

    @PostMapping
    public ResponseEntity<MessageResponse<UserShip>> addUserShip(@RequestBody AddUserShip addUserShipDto) {
        logger.debug("Requête reçue : ajout d'un vaisseau pour l'utilisateur Discord ID : {}, Ship ID : {}",
                addUserShipDto.getDiscordId(), addUserShipDto.getShipId());

        return userShipService.addShipToUser(addUserShipDto);
    }

    @GetMapping("/fleet-summary")
    public ResponseEntity<MessageResponse<Map<String, List<String>>>> getFleetSummary() {
        logger.info("Récupération du résumé de la flotte");
        return userShipService.getFleetSummary();
    }

    @DeleteMapping
    public ResponseEntity<MessageResponse<Void>> deleteUserShip(@RequestParam Long discordId, @RequestParam Long shipId) {
        logger.debug("Requête reçue : suppression du vaisseau ID : {} pour l'utilisateur ID : {}", shipId, discordId);
        return userShipService.deleteShipFromUser(discordId, shipId);
    }

}
