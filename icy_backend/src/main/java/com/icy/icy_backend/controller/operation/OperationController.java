package com.icy.icy_backend.controller.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.OperationDraftSummaryDTO;
import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.service.operation.OperationService;
import com.icy.icy_backend.service.operation.OperationAssignmentService;
import com.icy.icy_backend.service.operation.OperationShipService;
import com.icy.icy_backend.service.operation.OperationGroupService;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.controller.dto.response.event.OperationShipProposalResponseDTO;
import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.event.CreateEventRequest;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.controller.dto.response.event.OperationGroupResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.OperationAssignmentRequestResponseDTO;
import com.icy.icy_backend.controller.dto.operation.OperationShipRequirementRequest;
import com.icy.icy_backend.controller.dto.response.event.OperationShipRequirementResponseDTO;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.event.EventService;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.transaction.annotation.Transactional;

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
    private final OperationAssignmentRequestRepository requestRepository;
    private final EventService eventService;
    private final UserShipRepository userShipRepository;
    private final UserRepository userRepository;
    private final com.icy.icy_backend.service.operation.OperationShipRequirementService shipRequirementService;

    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @Transactional
    public ResponseEntity<MessageResponse<OperationResponseDTO>> create(@RequestBody CreateEventRequest request) {
        String type = eventService.requireExistingEventTypeName(request.getType());
        // Un brouillon n'est annoncé nulle part : ni calendrier, ni Discord, ni notification.
        ResponseEntity<MessageResponse<EventResponseDTO>> created = eventService.createEvent(type, request.getTitle(), request.getDescription(), request.getStartDateTime(), request.getEndDateTime(), false);
        UUID eventId = created.getBody().getData().getId();
        operationService.convert(eventId);
        OperationUpdateRequest seed = new OperationUpdateRequest();
        seed.setBriefing(request.getDescription());
        seed.setImageUrl(request.getImageUrl());
        seed.setAllowShipProposals(request.getAllowShipProposals());
        return operationService.update(eventId, seed);
    }

    @GetMapping("/{id}/ships")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<List<OperationShipProposalResponseDTO>>> ships(@PathVariable UUID id) {
        operationRepository.findById(id).filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationShipProposalResponseDTO> proposals = proposalRepository.findByOperationEventIdOrderByCreatedAtAsc(id).stream()
                .map(proposal -> new OperationShipProposalResponseDTO(proposal,
                        userShipRepository.findByUserIdAndShipId(proposal.getOwnerUserId(), proposal.getShipId()).orElse(null),
                        proposal.getPilotUserId() == null ? null : userRepository.findById(proposal.getPilotUserId()).map(user -> user.getUsername()).orElse(null)))
                .toList();
        return messageService.buildResponse("operation.ships", proposals);
    }

    @PostMapping("/{id}/groups")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> createGroup(@PathVariable UUID id, @RequestBody OperationGroupRequest request) {
        return groupService.create(id, request);
    }

    @PutMapping("/{id}/groups/{groupId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> updateGroup(@PathVariable UUID id, @PathVariable Long groupId, @RequestBody OperationGroupRequest request) {
        return groupService.update(id, groupId, request);
    }

    @DeleteMapping("/{id}/groups/{groupId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> deleteGroup(@PathVariable UUID id, @PathVariable Long groupId) {
        return groupService.delete(id, groupId);
    }

    @PutMapping("/{id}/groups/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> reorderGroups(@PathVariable UUID id, @RequestBody List<Long> groupIds) {
        return groupService.reorder(id, groupIds);
    }

    @PostMapping("/{id}/ships/proposals")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> proposeShip(@PathVariable UUID id, @RequestParam Long shipId, @RequestParam(required = false) Long groupId, @RequestParam(required = false) UUID requirementId) {
        return shipService.propose(id, shipId, groupId, requirementId);
    }

    @DeleteMapping("/{id}/ships/proposals/{proposalId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> withdrawShipProposal(@PathVariable UUID id, @PathVariable UUID proposalId) {
        return shipService.withdraw(id, proposalId);
    }

    @PostMapping("/{id}/ships/proposals/{proposalId}/unavailable")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> markShipUnavailable(@PathVariable UUID id, @PathVariable UUID proposalId) {
        return shipService.markUnavailable(id, proposalId);
    }

    @PutMapping("/{id}/ships/proposals/{proposalId}/pilot")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> setShipPilot(@PathVariable UUID id, @PathVariable UUID proposalId, @RequestParam(required = false) UUID pilotUserId) {
        return shipService.setPilot(id, proposalId, pilotUserId);
    }

    @GetMapping("/{id}/ship-requirements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<List<OperationShipRequirementResponseDTO>>> shipRequirements(@PathVariable UUID id) {
        return messageService.buildResponse("operation.ship.requirements", shipRequirementService.list(id));
    }

    @PostMapping("/{id}/ship-requirements")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationShipRequirementResponseDTO>> createShipRequirement(@PathVariable UUID id, @RequestBody OperationShipRequirementRequest request) {
        return shipRequirementService.create(id, request);
    }

    @PutMapping("/{id}/ship-requirements/{requirementId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationShipRequirementResponseDTO>> updateShipRequirement(@PathVariable UUID id, @PathVariable UUID requirementId, @RequestBody OperationShipRequirementRequest request) {
        return shipRequirementService.update(id, requirementId, request);
    }

    @DeleteMapping("/{id}/ship-requirements/{requirementId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Void>> deleteShipRequirement(@PathVariable UUID id, @PathVariable UUID requirementId) {
        return shipRequirementService.delete(id, requirementId);
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> approveAssignment(@PathVariable UUID requestId) { return assignmentService.decide(requestId, true); }

    @PostMapping("/assignment-requests/{requestId}/refuse")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<Void>> refuseAssignment(@PathVariable UUID requestId) { return assignmentService.decide(requestId, false); }

    @GetMapping("/{id}/assignment-requests")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse<List<OperationAssignmentRequestResponseDTO>>> assignmentRequests(@PathVariable UUID id) {
        List<OperationAssignmentRequestResponseDTO> requests = assignmentService.visibleRequests(id).stream().map(OperationAssignmentRequestResponseDTO::new).toList();
        return messageService.buildResponse("operation.assignment.requests", requests);
    }

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
        operationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationGroupResponseDTO> groups = operationGroupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(id).stream().map(OperationGroupResponseDTO::new).toList();
        return messageService.buildResponse("operation.groups.edit", groups);
    }

    @PostMapping("/{id}/convert")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OperationResponseDTO>> convert(@PathVariable UUID id) {
        boolean wasVisible = eventRepository.findById(id).map(event -> !eventService.isUnpublishedOperation(event)).orElse(false);
        ResponseEntity<MessageResponse<OperationResponseDTO>> response = operationService.convert(id);
        // L'événement devient un brouillon : il quitte les calendriers ouverts et Discord jusqu'à sa publication.
        if (wasVisible) eventRepository.findById(id).filter(eventService::isUnpublishedOperation).ifPresent(eventService::announceWithdrawn);
        return response;
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

    @GetMapping("/drafts")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<OperationDraftSummaryDTO>>> drafts() {
        List<OperationDraftSummaryDTO> drafts = operationRepository.findByPublicationStatusOrderByUpdatedAtDesc(Operation.PublicationStatus.DRAFT).stream()
                .filter(operation -> operation.getEvent() != null)
                .map(OperationDraftSummaryDTO::new)
                .toList();
        return messageService.buildResponse("operation.drafts", drafts);
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
