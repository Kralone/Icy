package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;
import com.icy.icy_backend.db.entity.user.User;

@Entity
@Table(name = "events", schema = "events")
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
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean finished = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false, length = 20)
    @Builder.Default
    private ActivityType activityType = ActivityType.EVENT;

    /** Pôles auxquels l'activité est rattachée ; vide si elle ne concerne aucun pôle en particulier. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_poles", schema = "events", joinColumns = @JoinColumn(name = "event_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "pole", length = 16, nullable = false)
    @Builder.Default
    @Setter(AccessLevel.NONE)
    private java.util.Set<com.icy.icy_backend.db.entity.user.Specialty> poles = new java.util.HashSet<>();

    /**
     * Ancienne colonne à pôle unique, tenue à jour avec le premier pôle de la liste
     * pour qu'une version précédente de l'application relise des données cohérentes après un retour arrière.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "pole", length = 16)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private com.icy.icy_backend.db.entity.user.Specialty legacyPole;

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

    @PrePersist
    void onCreate() {
        this.legacyPole = com.icy.icy_backend.db.entity.user.Specialty.first(poles);
    }

    /** Remplace les pôles de l'activité ; null ou vide : aucun pôle. */
    public void setPoles(java.util.Collection<com.icy.icy_backend.db.entity.user.Specialty> wanted) {
        if (poles == null) poles = new java.util.HashSet<>();
        poles.clear();
        if (wanted != null) wanted.stream().filter(java.util.Objects::nonNull).forEach(poles::add);
        legacyPole = com.icy.icy_backend.db.entity.user.Specialty.first(poles);
    }

    /** Pôles dans l'ordre d'affichage (Logistique, Militaire, Industrie). */
    public java.util.List<com.icy.icy_backend.db.entity.user.Specialty> sortedPoles() {
        return poles == null ? java.util.List.of() : poles.stream().sorted().toList();
    }

    public boolean concerns(com.icy.icy_backend.db.entity.user.Specialty pole) {
        return pole != null && poles != null && poles.contains(pole);
    }
}







