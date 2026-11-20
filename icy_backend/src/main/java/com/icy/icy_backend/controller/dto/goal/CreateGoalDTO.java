package com.icy.icy_backend.controller.dto.goal;

import lombok.Data;

import java.util.UUID;

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

    /** Optionnel */
    private UUID userId;

    /** Pôle d'un objectif principal. En modification : absent, inchangé ; vide, détaché. Ignoré pour une étape. */
    private String pole;
}



