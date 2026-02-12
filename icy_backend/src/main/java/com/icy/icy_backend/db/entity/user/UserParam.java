package com.icy.icy_backend.db.entity.user;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "user_params", schema = "core")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserParam {
    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "notif_global", nullable = false)
    private Boolean notifGlobal = true;

    @Column(name = "notif_events", nullable = false)
    private Boolean notifEvents = true;

    @Column(name = "notif_fleet", nullable = false)
    private Boolean notifFleet = false;

    @Column(name = "notif_goals", nullable = false)
    private Boolean notifGoals = true;

    @Column(name = "notif_discord", nullable = false)
    private Boolean notifDiscord = false;
}
