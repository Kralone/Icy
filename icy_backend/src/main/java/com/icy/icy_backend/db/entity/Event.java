package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private LocalDateTime startDateTime;

    @Column(nullable = false)
    private LocalDateTime endDateTime;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private boolean finished = false;

    // 🔗 Synchronisation Discord
    @Column(name = "discord_channel_id", length = 50)
    private String discordChannelId;

    @Column(name = "discord_message_id", length = 50)
    private String discordMessageId;

    @ManyToOne
    @JoinColumn(name = "event_type", referencedColumnName = "name")
    private EventType type;

    @ManyToOne
    @JoinColumn(name = "creator_id")
    private User creator;

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
