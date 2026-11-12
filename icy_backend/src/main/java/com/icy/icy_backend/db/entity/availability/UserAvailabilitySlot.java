package com.icy.icy_backend.db.entity.availability;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

/** Créneau où un membre est habituellement disponible, à l'heure de Paris. La nuit appartient au jour où elle commence. */
@Entity
@Table(name = "user_availability", schema = "core")
@IdClass(UserAvailabilitySlot.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UserAvailabilitySlot {
    @Id @Column(name = "user_id", nullable = false) private UUID userId;
    @Id @Column(name = "day_of_week", nullable = false) private Short dayOfWeek;
    @Id @Enumerated(EnumType.STRING) @Column(name = "period", nullable = false, length = 16) private Period period;

    /** Matin 6h-12h, après-midi 12h-18h, soir 18h-23h, nuit 23h-6h. L'ordre est celui de la journée. */
    public enum Period { MORNING, AFTERNOON, EVENING, NIGHT }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        private UUID userId;
        private Short dayOfWeek;
        private Period period;
    }
}
