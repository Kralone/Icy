package com.icy.icy_backend.db.entity.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.util.UUID;

@Entity
@Table(name = "user_params", schema = "core")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserParam implements Persistable<UUID> {
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

    @Transient
    private boolean isNew = true;

    @Override
    public UUID getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    private void markNotNew() {
        this.isNew = false;
    }
}
