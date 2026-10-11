package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationShipRequirementRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationShipRequirementResponseDTO;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class OperationShipRequirementService {
    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final OperationShipRequirementRepository requirementRepository;
    private final MessageService messageService;

    @Transactional(readOnly = true)
    public List<OperationShipRequirementResponseDTO> list(UUID operationId) {
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        return requirementRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId).stream().map(OperationShipRequirementResponseDTO::new).toList();
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationShipRequirementResponseDTO>> create(UUID operationId, OperationShipRequirementRequest request) {
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        validate(operationId, request);
        OperationShipRequirement value = OperationShipRequirement.builder().operationEventId(operationId).groupId(request.getGroupId()).shipModelId(request.getShipModelId()).quantity(request.getQuantity()).notes(request.getNotes()).status(request.getStatus() == null ? OperationShipRequirement.Status.OPEN : request.getStatus()).build();
        return messageService.buildResponse("operation.ship.requirement.created", new OperationShipRequirementResponseDTO(requirementRepository.save(value)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationShipRequirementResponseDTO>> update(UUID operationId, UUID requirementId, OperationShipRequirementRequest request) {
        OperationShipRequirement value = requirementRepository.findById(requirementId).filter(item -> operationId.equals(item.getOperationEventId())).orElseThrow(() -> new ResourceNotFoundException("Besoin de vaisseau introuvable"));
        validate(operationId, request);
        value.setGroupId(request.getGroupId()); value.setShipModelId(request.getShipModelId()); value.setQuantity(request.getQuantity()); value.setNotes(request.getNotes());
        if (request.getStatus() != null) value.setStatus(request.getStatus());
        value.setUpdatedAt(LocalDateTime.now());
        return messageService.buildResponse("operation.ship.requirement.updated", new OperationShipRequirementResponseDTO(requirementRepository.save(value)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> delete(UUID operationId, UUID requirementId) {
        OperationShipRequirement value = requirementRepository.findById(requirementId).filter(item -> operationId.equals(item.getOperationEventId())).orElseThrow(() -> new ResourceNotFoundException("Besoin de vaisseau introuvable"));
        requirementRepository.delete(value);
        return messageService.buildResponse("operation.ship.requirement.deleted", null);
    }

    private void validate(UUID operationId, OperationShipRequirementRequest request) {
        if (request.getQuantity() == null || request.getQuantity() < 1 || request.getQuantity() > 100) throw new IllegalArgumentException("Quantité de vaisseaux invalide");
        if (request.getNotes() != null && request.getNotes().length() > 5000) throw new IllegalArgumentException("Notes trop longues");
        if (request.getGroupId() != null) {
            OperationGroup group = groupRepository.findById(request.getGroupId()).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
            if (!operationId.equals(group.getOperationEventId())) throw new IllegalArgumentException("Le groupe appartient à une autre opération");
        }
    }
}
