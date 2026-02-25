package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;
import com.icy.icy_backend.db.entity.user.User;

@Entity
@Getter
@Setter
@Table(name = "event_participation", schema = "events", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"event_id", "user_id"})
})
public class EventParticipation {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private int status; // -1 Refusé, 0 Peut-être, 1 Confirmé
}





