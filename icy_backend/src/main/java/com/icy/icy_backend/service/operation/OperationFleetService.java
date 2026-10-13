package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.event.OperationShipProposalResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.OperationShipRequirementResponseDTO;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** Lecture de la flotte d'une opération : vaisseaux proposés et besoins, avec ce que le catalogue, le hangar et la présence en disent aujourd'hui. */
@Service
@RequiredArgsConstructor
public class OperationFleetService {
    private final OperationRepository operationRepository;
    private final OperationShipProposalRepository proposalRepository;
    private final OperationShipRequirementService requirementService;
    private final ShipRepository shipRepository;
    private final UserRepository userRepository;
    private final UserShipRepository userShipRepository;
    private final EventParticipationRepository participationRepository;

    @Transactional(readOnly = true)
    public List<OperationShipProposalResponseDTO> proposals(UUID operationId) {
        Operation operation = operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        boolean organizer = AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER");
        if (operation.getPublicationStatus() != Operation.PublicationStatus.PUBLISHED && !organizer) throw new ResourceNotFoundException("Opération introuvable");

        List<OperationShipProposal> proposals = proposalRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId);
        Map<Long, Ship> ships = ships(proposals.stream().map(OperationShipProposal::getShipId));
        Map<UUID, String> names = userRepository.findAllById(proposals.stream()
                        .flatMap(proposal -> Stream.of(proposal.getOwnerUserId(), proposal.getPilotUserId())).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, User::getUsername));
        return proposals.stream().map(proposal -> {
            Ship ship = ships.get(proposal.getShipId());
            return new OperationShipProposalResponseDTO(proposal.getId(), proposal.getShipId(), proposal.getOwnerUserId(),
                    names.getOrDefault(proposal.getOwnerUserId(), "Compte désactivé"), proposal.getPilotUserId(),
                    proposal.getPilotUserId() == null ? null : names.getOrDefault(proposal.getPilotUserId(), "Compte désactivé"),
                    proposal.getGroupId(), proposal.getRequirementId(), proposal.getStatus(),
                    ship == null ? null : ship.getName(), ship == null ? null : ship.getImageUrl(),
                    userShipRepository.existsByUserIdAndShipId(proposal.getOwnerUserId(), proposal.getShipId()),
                    participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, proposal.getOwnerUserId(), 1));
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<OperationShipRequirementResponseDTO> requirements(UUID operationId) {
        // Le contrôle d'accès (brouillon invisible pour un membre) est celui de la liste des besoins.
        List<OperationShipRequirementResponseDTO> requirements = requirementService.list(operationId);
        Map<Long, Ship> ships = ships(requirements.stream().map(OperationShipRequirementResponseDTO::shipModelId));
        List<OperationShipProposal> proposals = proposalRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId);
        return requirements.stream().map(requirement -> {
            Ship ship = requirement.shipModelId() == null ? null : ships.get(requirement.shipModelId());
            long accepted = linked(proposals, requirement.id(), OperationShipProposal.Status.ACCEPTED);
            long proposed = linked(proposals, requirement.id(), OperationShipProposal.Status.PROPOSED);
            return requirement.withFleet(ship == null ? null : ship.getName(), ship == null ? null : ship.getImageUrl(), accepted, proposed);
        }).toList();
    }

    private long linked(List<OperationShipProposal> proposals, UUID requirementId, OperationShipProposal.Status status) {
        return proposals.stream().filter(proposal -> requirementId.equals(proposal.getRequirementId()) && proposal.getStatus() == status).count();
    }

    private Map<Long, Ship> ships(Stream<Long> ids) {
        return shipRepository.findAllById(ids.filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Ship::getId, Function.identity()));
    }
}
