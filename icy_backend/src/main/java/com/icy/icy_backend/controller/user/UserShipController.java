package com.icy.icy_backend.controller.user;

import com.icy.icy_backend.controller.dto.ship.AddShipDTO;
import com.icy.icy_backend.controller.dto.user.AddUserShip;
import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.user.UserShipService;
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
    private final UserService userService;

    public UserShipController(UserShipService userShipService, UserService userService) {
        this.userShipService = userShipService;
        this.userService = userService;
    }

    // ===== USER ENDPOINTS (token) =====

    @GetMapping
    public ResponseEntity<MessageResponse<List<UserShip>>> getShips() {
        UUID userId = AuthUtils.getCurrentUserId();
        logger.debug("USER : récupération des vaisseaux pour userId : {}", userId);
        return userShipService.getShipsByUserId(userId);
    }

    @PostMapping
    public ResponseEntity<MessageResponse<UserShip>> addShip(@RequestBody AddShipDTO addShipDTO) {
        UUID userId = AuthUtils.getCurrentUserId();
        logger.debug("USER : ajout d'un vaisseau pour userId : {}, shipId : {}", userId, addShipDTO.getShipId());

        return userShipService.addShipToUser(
                userId,
                addShipDTO.getShipId(),
                addShipDTO.isInGame(),
                addShipDTO.isRewardInGame(),
                addShipDTO.isLoaner()
        );
    }

    @DeleteMapping
    public ResponseEntity<MessageResponse<Void>> deleteShip(@RequestParam Long shipId) {
        UUID userId = AuthUtils.getCurrentUserId();
        logger.debug("USER : suppression du vaisseau shipId : {} pour userId : {}", shipId, userId);
        return userShipService.deleteShipFromUser(userId, shipId);
    }

    // ===== BOT ENDPOINTS =====

    @GetMapping("/bot")
    public ResponseEntity<MessageResponse<List<UserShip>>> getUserShipsForBot(@RequestParam Long discordId) {
        logger.debug("BOT : récupération des vaisseaux pour discordId : {}", discordId);
        return userShipService.getShipsByUserId(discordId);
    }

    @PostMapping("/bot")
    public ResponseEntity<MessageResponse<UserShip>> addUserShipForBot(@RequestBody AddUserShip addUserShipDto) {
        logger.debug("BOT : ajout d'un vaisseau pour discordId : {}, shipId : {}",
                addUserShipDto.getDiscordId(), addUserShipDto.getShipId());

        return userShipService.addShipToUser(
                userService.resolveUser(addUserShipDto.getDiscordId()).getId(),
                addUserShipDto.getShipId(),
                addUserShipDto.isInGame(),
                addUserShipDto.isRewardInGame(),
                addUserShipDto.isLoaner()
        );
    }

    @DeleteMapping("/bot")
    public ResponseEntity<MessageResponse<Void>> deleteUserShipForBot(@RequestParam Long discordId, @RequestParam Long shipId) {
        logger.debug("BOT : suppression du vaisseau shipId : {} pour discordId : {}", shipId, discordId);
        return userShipService.deleteShipFromUser(discordId, shipId);
    }

    // ===== COMMUN =====

    @GetMapping("/fleet-summary")
    public ResponseEntity<MessageResponse<List<FleetSummaryResponse>>> getFleetSummary() {
        logger.info("Récupération du résumé de la flotte");
        return userShipService.getFleetSummary();
    }
}






