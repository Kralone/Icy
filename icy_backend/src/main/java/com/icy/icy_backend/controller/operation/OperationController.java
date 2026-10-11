package com.icy.icy_backend.controller.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationResponseDTO;
import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.service.operation.OperationService;
import com.icy.icy_backend.service.operation.OperationAssignmentService;
import com.icy.icy_backend.service.operation.OperationShipService;
import com.icy.icy_backend.service.operation.OperationGroupService;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.controller.dto.response.event.OperationShipProposalResponseDTO;
import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.controller.dto.response.event.OperationGroupResponseDTO;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;
import java.util.List;
import java.util.stream.StreamSupport;

@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class OperationController {
    private final EventRepository eventRepository;
    private final OperationRepository operationRepository;
    private final MessageService messageService;
    private final OperationService operationService;
    private final OperationGroupRepository operationGroupRepository;
    private final OperationAssignmentService assignmentService;
    private final OperationShipService shipService;
    private final OperationGroupService groupService;
    private final OperationShipProposalRepository proposalRepository;

    @GetMapping("/{id}/ships")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<List<OperationShipProposalResponseDTO>>> ships(@PathVariable UUID id) {
        operationRepository.findById(id).filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationShipProposalResponseDTO> proposals = proposalRepository.findByOperationEventIdOrderByCreatedAtAsc(id).stream().map(OperationShipProposalResponseDTO::new).toList();
        return messageService.buildResponse("operation.ships", proposals);
    }

    @PostMapping("/{id}/groups")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> createGroup(@PathVariable UUID id, @RequestBody OperationGroupRequest request) {
        return groupService.create(id, request);
    }

    @PostMapping("/{id}/ships/proposals")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> proposeShip(@PathVariable UUID id, @RequestParam Long shipId, @RequestParam(required = false) Long groupId) {
        return shipService.propose(id, shipId, groupId);
    }

    @PostMapping("/{id}/assignments/me/{groupId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> assignMe(@PathVariable UUID id, @PathVariable Long groupId) {
        return assignmentService.assign(id, groupId);
    }

    @PostMapping("/{id}/assignment-requests/me/{groupId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> requestAssignment(@PathVariable UUID id, @PathVariable Long groupId) {
        return assignmentService.request(id, groupId);
    }

    @PostMapping("/assignment-requests/{requestId}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> approveAssignment(@PathVariable UUID requestId) { return assignmentService.decide(requestId, true); }

    @PostMapping("/assignment-requests/{requestId}/refuse")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> refuseAssignment(@PathVariable UUID requestId) { return assignmentService.decide(requestId, false); }

    @GetMapping("/{id}/groups")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<List<OperationGroupResponseDTO>>> groups(@PathVariable UUID id) {
        operationRepository.findById(id).filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroupResponseDTO> groups = operationGroupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(id)
                .stream().map(OperationGroupResponseDTO::new).toList();
        return messageService.buildResponse("operation.groups", groups);
    }

    @GetMapping("/{id}/groups/edit")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<OperationGroupResponseDTO>>> groupsForEdit(@PathVariable UUID id) {
        operationRepository.findById(id).filter(value -> value.getActivityType() == ActivityType.OPERATION).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroupResponseDTO> groups = operationGroupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(id).stream().map(OperationGroupResponseDTO::new).toList();
        return messageService.buildResponse("operation.groups.edit", groups);
    }

    @PostMapping("/{id}/convert")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> convert(@PathVariable UUID id) {
        return operationService.convert(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> update(@PathVariable UUID id, @RequestBody OperationUpdateRequest request) {
        return operationService.update(id, request);
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> publish(@PathVariable UUID id) {
        return operationService.publish(id);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> get(@PathVariable UUID id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (event.getActivityType() != ActivityType.OPERATION) {
            throw new ResourceNotFoundException("Opération introuvable");
        }
        Operation operation = operationRepository.findById(id)
                .filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        return messageService.buildResponse("operation.get", new OperationResponseDTO(event, operation));
    }

    @GetMapping("/{id}/edit")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> edit(@PathVariable UUID id) {
        Event event = eventRepository.findById(id)
                .filter(value -> value.getActivityType() == ActivityType.OPERATION)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        Operation operation = operationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brouillon introuvable"));
        return messageService.buildResponse("operation.edit", new OperationResponseDTO(event, operation));
    }
}
