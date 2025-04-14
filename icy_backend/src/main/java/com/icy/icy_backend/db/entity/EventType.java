package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "event_types")
@Getter
@Setter
@AllArgsConstructor
public class EventType {

    public EventType() {
        name = "Default";
        textColor = "black";
        imageUrl = "default_event_type_image.png";
    }

    @Id
    @Column(length = 100)
    private String name; // ex: "Exploration", "Combat", ...

    @Column(length = 50)
    private String textColor;

    @Column
    private String imageUrl;
}
