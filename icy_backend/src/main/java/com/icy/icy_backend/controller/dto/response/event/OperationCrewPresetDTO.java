package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;

import java.util.List;
import java.util.UUID;

public record OperationCrewPresetDTO(
        UUID id,
        String name,
        String description,
        /** Null si le modèle a disparu du catalogue. */
        Long shipModelId,
        String shipModelName,
        String shipModelImageUrl,
        Integer capacity,
        OperationGroup.PositionMode positionMode,
        boolean archived,
        List<Position> positions) {

    public record Position(String label, String icon, Integer capacity) {}
}
