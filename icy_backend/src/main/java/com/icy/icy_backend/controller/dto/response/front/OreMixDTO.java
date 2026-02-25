package com.icy.icy_backend.controller.dto.response.front;

public record OreMixDTO(
        String oreCode,
        Double probability,
        Double minPct,
        Double maxPct,
        Double medPct
) {
}
