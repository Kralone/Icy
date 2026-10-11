package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
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
import java.util.List;

@Service @RequiredArgsConstructor
public class OperationShipService {
    private final OperationRepository operationRepository;
    private final UserShipRepository userShipRepository;
    private final OperationShipProposalRepository proposalRepository;
    private final MessageService messageService;
    private final OperationGroupRepository groupRepository;
    private final EventParticipationRepository participationRepository;
    private final OperationShipRequirementRepository requirementRepository;
    @Transactional
    public ResponseEntity<MessageResponse<Void>> propose(UUID operationId, Long shipId, Long groupId, UUID requirementId) {
        operationRepository.findById(operationId).filter(o -> o.getPublicationStatus() == com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED && o.isAllowShipProposals())
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        UUID owner = AuthUtils.getCurrentUserId();
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, owner, 1)) {
            throw new IllegalStateException("La participation Présent est requise pour proposer un vaisseau");
        }
        if (!userShipRepository.existsByUserIdAndShipId(owner, shipId)) throw new ResourceNotFoundException("Vaisseau absent du hangar personnel");
        if (groupId != null) {
            var group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
            if (!operationId.equals(group.getOperationEventId()) || groupRepository.existsByParentId(groupId)) throw new IllegalArgumentException("Groupe feuille invalide pour cette opération");
        }
        if (requirementId != null) {
            OperationShipRequirement requirement = requirementRepository.findById(requirementId)
                    .filter(value -> operationId.equals(value.getOperationEventId()))
                    .filter(value -> value.getStatus() == OperationShipRequirement.Status.OPEN)
                    .orElseThrow(() -> new ResourceNotFoundException("Besoin de vaisseau introuvable"));
            if (requirement.getGroupId() != null && groupId != null && !requirement.getGroupId().equals(groupId)) {
                throw new IllegalArgumentException("Le besoin et le groupe ciblé ne correspondent pas");
            }
            if (requirement.getShipModelId() != null && !requirement.getShipModelId().equals(shipId)) {
                throw new IllegalArgumentException("Le vaisseau ne correspond pas au modèle requis");
            }
            long activeProposals = proposalRepository.countByRequirementIdAndStatusIn(requirementId,
                    List.of(OperationShipProposal.Status.PROPOSED, OperationShipProposal.Status.ACCEPTED));
            if (activeProposals >= requirement.getQuantity()) {
                throw new IllegalStateException("Le besoin de vaisseau est déjà rempli");
            }
            if (groupId == null) groupId = requirement.getGroupId();
        }
        OperationShipProposal proposal = OperationShipProposal.builder().operationEventId(operationId).groupId(groupId).requirementId(requirementId).ownerUserId(owner).shipId(shipId).build();
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.proposed", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> withdraw(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = proposalRepository.findByIdAndOperationEventId(proposalId, operationId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposition de vaisseau introuvable"));
        UUID owner = AuthUtils.getCurrentUserId();
        if (!owner.equals(proposal.getOwnerUserId())) {
            throw new org.springframework.security.access.AccessDeniedException("Seul le propriétaire peut retirer cette proposition");
        }
        proposalRepository.delete(proposal);
        return messageService.buildResponse("operation.ship.withdrawn", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> markUnavailable(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = proposalRepository.findByIdAndOperationEventId(proposalId, operationId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposition de vaisseau introuvable"));
        proposal.setStatus(OperationShipProposal.Status.UNAVAILABLE);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.unavailable", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> setPilot(UUID operationId, UUID proposalId, UUID pilotUserId) {
        OperationShipProposal proposal = proposalRepository.findByIdAndOperationEventId(proposalId, operationId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposition de vaisseau introuvable"));
        if (pilotUserId != null && !participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, pilotUserId, 1)) {
            throw new IllegalStateException("Le pilote doit être inscrit Présent à l’opération");
        }
        proposal.setPilotUserId(pilotUserId);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.pilot.updated", null);
    }
}
