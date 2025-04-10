package com.icy.icy_backend.controller.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateEventRequest {
    private String type;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
}