package com.icy.icy_backend.controller.dto.response.event;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import lombok.Value;
import lombok.AllArgsConstructor;
import java.util.UUID;
/**
 * Vaisseau du hangar d'un membre, mis à disposition de l'opération. Le nom et l'image viennent du catalogue : ils restent
 * connus même si l'appareil a quitté le hangar (inHangar faux) ou si son propriétaire n'est plus inscrit Présent.
 */
@Value
@AllArgsConstructor
public class OperationShipProposalResponseDTO {
 UUID id; Long shipId; UUID ownerUserId; String ownerUsername; UUID pilotUserId; String pilotUsername; Long groupId; UUID requirementId; OperationShipProposal.Status status; String shipName; String shipImageUrl; boolean inHangar; boolean ownerPresent;
}
