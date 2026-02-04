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
    private String imageUrl;
    private String focus;
    private String crew;
    private boolean inGamePurchase;
    private boolean loaner;

    public UserShipDTO(Long shipId, String name, String brand, String imageUrl, String focus, String crew,
                       boolean inGamePurchase, boolean loaner) {
        this.shipId = shipId;
        this.name = name;
        this.brand = brand;
        this.imageUrl = imageUrl;
        this.focus = focus;
        this.crew = crew;
        this.inGamePurchase = inGamePurchase;
        this.loaner = loaner;
    }

    public UserShipDTO(UserShip userShip) {
        Ship ship = userShip.getShip();

        this.shipId = ship.getId();
        this.name = ship.getName();
        this.brand = ship.getBrand().getName();
        this.imageUrl = ship.getImageUrl();
        this.focus = ship.getFocus();
        this.crew = ship.getCrew();
        this.inGamePurchase = userShip.getInGamePurchase();
        this.loaner = userShip.getLoaner();
    }

    public static UserShipDTO from(UserShip userShip) {
        Ship ship = userShip.getShip();
        return new UserShipDTO(
                ship.getId(),
                ship.getName(),
                ship.getBrand().getName(),
                ship.getImageUrl(),
                ship.getFocus(),
                ship.getCrew(),
                userShip.getInGamePurchase(),
                userShip.getLoaner()
        );
    }
}





