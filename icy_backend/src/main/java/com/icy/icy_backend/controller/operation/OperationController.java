package com.icy.icy_backend.controller.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationResponseDTO;
import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.service.operation.OperationService;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class OperationController {
    private final EventRepository eventRepository;
    private final OperationRepository operationRepository;
    private final MessageService messageService;
    private final OperationService operationService;

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
