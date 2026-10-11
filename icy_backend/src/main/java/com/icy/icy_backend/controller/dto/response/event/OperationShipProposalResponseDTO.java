package com.icy.icy_backend.controller.dto.response.event;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import lombok.Value;
import lombok.AllArgsConstructor;
import java.util.UUID;
@Value
@AllArgsConstructor
public class OperationShipProposalResponseDTO {
 UUID id; Long shipId; UUID ownerUserId; Long groupId; OperationShipProposal.Status status;
 public OperationShipProposalResponseDTO(OperationShipProposal value) { this(value.getId(), value.getShipId(), value.getOwnerUserId(), value.getGroupId(), value.getStatus()); }
}
