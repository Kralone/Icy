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

/**
 * Vaisseaux mis à disposition d'une opération. Une proposition ne concerne que l'appareil : elle n'affecte ni son
 * propriétaire ni un équipage à un groupe, et son retrait ne touche aucune affectation.
 */
@Service @RequiredArgsConstructor
public class OperationShipService {
    private final OperationRepository operationRepository;
    private final UserShipRepository userShipRepository;
    private final OperationShipProposalRepository proposalRepository;
    private final MessageService messageService;
    private final OperationGroupRepository groupRepository;
    private final EventParticipationRepository participationRepository;
    private final OperationShipRequirementRepository requirementRepository;

    private OperationLock operationLock;

    @org.springframework.beans.factory.annotation.Autowired
    public void setOperationLock(OperationLock operationLock) {
        this.operationLock = operationLock;
    }

    /** Clôture automatique à l'heure de fin : voir OperationLock. */
    private void requireOpen(UUID operationId) {
        if (operationLock != null) operationLock.requireOpen(operationId);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> propose(UUID operationId, Long shipId, Long groupId, UUID requirementId) {
        operationRepository.findById(operationId).filter(o -> o.getPublicationStatus() == com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED && o.isAllowShipProposals())
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        requireOpen(operationId);
        UUID owner = AuthUtils.getCurrentUserId();
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, owner, 1)) {
            throw new IllegalStateException("La participation Présent est requise pour proposer un vaisseau");
        }
        if (!userShipRepository.existsByUserIdAndShipId(owner, shipId)) throw new ResourceNotFoundException("Vaisseau absent du hangar personnel");
        if (proposalRepository.existsByOperationEventIdAndOwnerUserIdAndShipId(operationId, owner, shipId)) {
            throw new IllegalStateException("Ce vaisseau est déjà proposé pour cette opération.");
        }
        if (groupId != null) {
            var group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
            if (!operationId.equals(group.getOperationEventId()) || groupRepository.existsByParentId(groupId)) throw new IllegalArgumentException("Groupe feuille invalide pour cette opération");
        }
        if (requirementId != null) {
            // Sous verrou : deux propositions simultanées pour le même besoin passent l'une après l'autre.
            OperationShipRequirement requirement = requirementRepository.findLockedById(requirementId)
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

    /** Organisateur : retient le vaisseau. S'il répond à un besoin, la quantité demandée n'est jamais dépassée. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> accept(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = find(operationId, proposalId);
        requireOpen(operationId);
        if (proposal.getStatus() == OperationShipProposal.Status.ACCEPTED) return messageService.buildResponse("operation.ship.accepted", null);
        if (!userShipRepository.existsByUserIdAndShipId(proposal.getOwnerUserId(), proposal.getShipId())) {
            throw new IllegalStateException("Ce vaisseau n’est plus dans le hangar de son propriétaire.");
        }
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, proposal.getOwnerUserId(), 1)) {
            throw new IllegalStateException("Le propriétaire n’est plus inscrit Présent.");
        }
        if (proposal.getRequirementId() != null) {
            OperationShipRequirement requirement = requirementRepository.findLockedById(proposal.getRequirementId()).orElse(null);
            long accepted = proposalRepository.countByRequirementIdAndStatusIn(proposal.getRequirementId(), List.of(OperationShipProposal.Status.ACCEPTED));
            if (requirement != null && requirement.getStatus() == OperationShipRequirement.Status.CANCELLED) {
                throw new IllegalStateException("Le besoin lié est annulé : refusez ou retirez cette proposition.");
            }
            if (requirement != null && requirement.getShipModelId() != null && !requirement.getShipModelId().equals(proposal.getShipId())) {
                throw new IllegalStateException("Ce vaisseau ne correspond plus au modèle du besoin lié.");
            }
            if (requirement != null && accepted >= requirement.getQuantity()) {
                throw new IllegalStateException("Ce besoin est déjà couvert par les vaisseaux acceptés.");
            }
        }
        proposal.setStatus(OperationShipProposal.Status.ACCEPTED);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.accepted", null);
    }

    /** Organisateur : écarte le vaisseau. Le besoin éventuel redevient à couvrir ; aucune affectation n'est modifiée. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> decline(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = find(operationId, proposalId);
        requireOpen(operationId);
        proposal.setStatus(OperationShipProposal.Status.DECLINED);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.declined", null);
    }

    /** Retrait par le propriétaire, ou par un organisateur. */
    @Transactional
    public ResponseEntity<MessageResponse<Void>> withdraw(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = find(operationId, proposalId);
        UUID owner = AuthUtils.getCurrentUserId();
        boolean organizer = AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER");
        if (!organizer && !owner.equals(proposal.getOwnerUserId())) {
            throw new org.springframework.security.access.AccessDeniedException("Seul le propriétaire peut retirer cette proposition");
        }
        requireOpen(operationId);
        // Sinon un refus se contournerait : retirer puis proposer à nouveau remettrait l'appareil « Proposé ».
        if (!organizer && proposal.getStatus() == OperationShipProposal.Status.DECLINED) {
            throw new IllegalStateException("Cette proposition a été refusée par l’organisateur : elle ne peut pas être retirée.");
        }
        proposalRepository.delete(proposal);
        return messageService.buildResponse("operation.ship.withdrawn", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> markUnavailable(UUID operationId, UUID proposalId) {
        OperationShipProposal proposal = find(operationId, proposalId);
        requireOpen(operationId);
        proposal.setStatus(OperationShipProposal.Status.UNAVAILABLE);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.unavailable", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> setPilot(UUID operationId, UUID proposalId, UUID pilotUserId) {
        OperationShipProposal proposal = find(operationId, proposalId);
        requireOpen(operationId);
        if (pilotUserId != null && !participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, pilotUserId, 1)) {
            throw new IllegalStateException("Le pilote doit être inscrit Présent à l’opération");
        }
        proposal.setPilotUserId(pilotUserId);
        proposalRepository.save(proposal);
        return messageService.buildResponse("operation.ship.pilot.updated", null);
    }

    private OperationShipProposal find(UUID operationId, UUID proposalId) {
        return proposalRepository.findByIdAndOperationEventId(proposalId, operationId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposition de vaisseau introuvable"));
    }
}
