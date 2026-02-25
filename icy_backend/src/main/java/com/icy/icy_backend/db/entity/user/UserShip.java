package com.icy.icy_backend.db.entity.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.id.UserShipId;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_ships", schema = "fleet")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class UserShip {
    @EmbeddedId
    private UserShipId id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("shipId")
    @JoinColumn(name = "ship_id")
    private Ship ship;

    @Column(name = "in_game_purchase", nullable = false)
    private Boolean inGamePurchase = false;

    @Column(name = "reward_in_game", nullable = false)
    private Boolean rewardInGame = false;

    @Column(name = "loaner", nullable = false)
    private Boolean loaner = false;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();
}








