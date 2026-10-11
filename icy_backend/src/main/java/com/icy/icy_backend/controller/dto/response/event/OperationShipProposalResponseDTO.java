package com.icy.icy_backend.controller.dto.response.event;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import lombok.Value;
import lombok.AllArgsConstructor;
import java.util.UUID;
import com.icy.icy_backend.db.entity.user.UserShip;
@Value
@AllArgsConstructor
public class OperationShipProposalResponseDTO {
 UUID id; Long shipId; UUID ownerUserId; String ownerUsername; Long groupId; OperationShipProposal.Status status; String shipName; String shipImageUrl;
 public OperationShipProposalResponseDTO(OperationShipProposal value) { this(value, null); }
 public OperationShipProposalResponseDTO(OperationShipProposal value, UserShip ownedShip) {
  this(value.getId(), value.getShipId(), value.getOwnerUserId(), ownedShip == null || ownedShip.getUser() == null ? null : ownedShip.getUser().getUsername(), value.getGroupId(), value.getStatus(), ownedShip == null || ownedShip.getShip() == null ? null : ownedShip.getShip().getName(), ownedShip == null || ownedShip.getShip() == null ? null : ownedShip.getShip().getImageUrl());
 }
}
