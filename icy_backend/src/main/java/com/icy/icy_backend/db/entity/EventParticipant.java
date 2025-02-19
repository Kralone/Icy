package com.icy.icy_backend.db.entity;

import com.icy.icy_backend.db.entity.id.EventParticipantId;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "event_participants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EventParticipant {
    @EmbeddedId
    private EventParticipantId id;

    @ManyToOne
    @MapsId("eventId")
    @JoinColumn(name = "event_id")
    private Event event;

    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private String status;
}

