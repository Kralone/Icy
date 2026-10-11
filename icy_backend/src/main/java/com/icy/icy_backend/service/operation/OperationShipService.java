package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import com.icy.icy_backend.db.repository.event.*;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class OperationShipService {
    private final OperationRepository operationRepository;
    private final UserShipRepository userShipRepository;
    private final OperationShipProposalRepository proposalRepository;
    private final MessageService messageService;
    private final OperationGroupRepository groupRepository;
    @Transactional
    public ResponseEntity<MessageResponse<Void>> propose(UUID operationId, Long shipId, Long groupId) {
        operationRepository.findById(operationId).filter(o -> o.getPublicationStatus() == com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        UUID owner = AuthUtils.getCurrentUserId();
        if (!userShipRepository.existsByUserIdAndShipId(owner, shipId)) throw new ResourceNotFoundException("Vaisseau absent du hangar personnel");
        if (groupId != null) {
            var group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
            if (!operationId.equals(group.getOperationEventId()) || groupRepository.existsByParentId(groupId)) throw new IllegalArgumentException("Groupe feuille invalide pour cette opération");
        }
        OperationShipProposal proposal = OperationShipProposal.builder().operationEventId(operationId).groupId(groupId).ownerUserId(owner).shipId(shipId).build();
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.proposed", null);
    }
}
