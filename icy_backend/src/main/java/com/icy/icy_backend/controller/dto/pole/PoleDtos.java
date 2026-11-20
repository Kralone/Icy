package com.icy.icy_backend.controller.dto.pole;

import java.util.List;
import java.util.UUID;

public final class PoleDtos {
    private PoleDtos() {
    }

    /** Un pôle et ses Spécialistes référents, par ordre alphabétique. */
    public record Pole(String key, List<Specialist> specialists) {
    }

    /** Ce qu'un membre voit d'un référent : son nom et son avatar, rien d'autre. */
    public record Specialist(UUID id, String username, String avatarUrl) {
    }
}
