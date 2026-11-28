package com.icy.icy_backend.controller.companion;

import java.util.UUID;

/**
 * Réponse au service du compagnon (dépôt icy_companion_service) : ce membre peut-il rejoindre
 * l'opération en direct, pour envoyer son état ({@code canReport}) ou suivre celui du groupe ({@code canView}) ?
 */
public record CompanionMembershipDTO(UUID operationId, String operationName, UUID userId, String handle, boolean canReport, boolean canView) {}
