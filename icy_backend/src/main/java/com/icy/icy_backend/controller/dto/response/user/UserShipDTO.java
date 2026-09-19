package com.icy.icy_backend.controller.dto.response.user;

import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.UserShip;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class UserShipDTO {
    private Long shipId;
    private String name;
    private String brand;
    private String brandImageUrl;
    private String imageUrl;
    private String focus;
    private String crew;
    private boolean inGamePurchase;
    private boolean rewardInGame;
    private boolean loaner;

    public UserShipDTO(Long shipId, String name, String brand, String brandImageUrl, String imageUrl, String focus, String crew,
                       boolean inGamePurchase, boolean rewardInGame, boolean loaner) {
        this.shipId = shipId;
        this.name = name;
        this.brand = brand;
        this.brandImageUrl = brandImageUrl;
        this.imageUrl = imageUrl;
        this.focus = focus;
        this.crew = crew;
        this.inGamePurchase = inGamePurchase;
        this.rewardInGame = rewardInGame;
        this.loaner = loaner;
    }

    public UserShipDTO(UserShip userShip) {
        Ship ship = userShip.getShip();

        this.shipId = ship.getId();
        this.name = ship.getName();
        this.brand = ship.getBrand().getName();
        this.brandImageUrl = ship.getBrand().getImageUrl();
        this.imageUrl = ship.getImageUrl();
        this.focus = displayFocus(ship);
        this.crew = ship.getCrew();
        this.inGamePurchase = userShip.getInGamePurchase();
        this.rewardInGame = userShip.getRewardInGame();
        this.loaner = userShip.getLoaner();
    }

    public static UserShipDTO from(UserShip userShip) {
        Ship ship = userShip.getShip();
        return new UserShipDTO(
                ship.getId(),
                ship.getName(),
                ship.getBrand().getName(),
                ship.getBrand().getImageUrl(),
                ship.getImageUrl(),
                displayFocus(ship),
                ship.getCrew(),
                userShip.getInGamePurchase(),
                userShip.getRewardInGame(),
                userShip.getLoaner()
        );
    }

    /** Legacy PYAM rows predate the focus column; keep them grouped in fleet views. */
    private static String displayFocus(Ship ship) {
        if (ship.getFocus() != null && !ship.getFocus().isBlank()) return ship.getFocus();
        String name = ship.getName() == null ? "" : ship.getName();
        return name.matches("(?i).*\\bpyam(?:\\s+exec)?\\b.*") ? "PYAM" : null;
    }
}





