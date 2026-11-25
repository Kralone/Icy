package com.icy.icy_backend.controller.dto.event;

import lombok.Getter;
import lombok.Setter;

/** Création ou modification d'un type d'événement. */
@Getter
@Setter
public class EventTypeRequest {
    private String name;
    private String textColor;
    private String backgroundColor;
    private String imageUrl;
}
