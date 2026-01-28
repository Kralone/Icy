package com.icy.icy_backend.controller.dto;

import lombok.Data;

@Data
public class CreateGoalDTO {

    private String name;
    private String description;
    private Integer target;

    /** Utilisé par l'admin pour update (création forcée à 0 côté service) */
    private Integer current;

    /** Utilisé par l'admin pour update (création forcée à false côté service) */
    private Boolean pinned;

    /** null => root */
    private Long parentId;
}
