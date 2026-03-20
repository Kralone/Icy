package com.icy.icy_backend.controller.dto.response.mining;

public record MiningSheetShipCargoGridDTO(
        int sizeX,
        int sizeY,
        int sizeZ,
        long slotCount
) {
}
