package com.icy.icy_backend.db.entity.member;

import jakarta.persistence.*;
import lombok.*;

/** Seuils d'activité, en jours sans activité. Une seule ligne (id 1). */
@Entity
@Table(name = "member_activity_settings", schema = "core")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MemberActivitySettings {
    public static final short SINGLE_ID = 1;
    @Id private Short id = SINGLE_ID;
    /** À partir de ce nombre de jours, le membre est « à surveiller ». */
    @Column(name = "watch_days", nullable = false) private int watchDays = 14;
    /** À partir de ce nombre de jours, le membre est « inactif ». */
    @Column(name = "inactive_days", nullable = false) private int inactiveDays = 30;
}
