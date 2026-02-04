package com.icy.icy_backend.controller.dto.scworldevent;

import lombok.Data;

import java.util.Map;

@Data
public class UpsertScWorldEventParticipationDTO {

    /**
     * -1 = refus
     *  0 = peut-être
     *  1 = confirmé
     */
    private Short status;

    /**
     * Points saisis par l'utilisateur, validés via le schema de l'event
     */
    private Map<String, Integer> points;
}


