package com.icy.icy_backend.db.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.icy.icy_backend.db.entity.id.UserShipId;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_ships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class UserShip {
    @EmbeddedId
    private UserShipId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("shipId")
    @JoinColumn(name = "ship_id")
    private Ship ship;
}

