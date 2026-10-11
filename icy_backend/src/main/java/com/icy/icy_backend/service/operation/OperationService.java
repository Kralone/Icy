package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationResponseDTO;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;
import java.net.URI;

@Service
@RequiredArgsConstructor
public class OperationService {
    private final EventRepository eventRepository;
    private final OperationRepository operationRepository;
    private final MessageService messageService;
    private final EntityManager entityManager;

    @Transactional
    public ResponseEntity<MessageResponse<OperationResponseDTO>> convert(UUID eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Événement introuvable"));
        event.setActivityType(ActivityType.OPERATION);
        // The operations table has a database trigger requiring the parent event
        // to be OPERATION. Flush this transition before inserting the child row.
        eventRepository.save(event);
        entityManager.flush();
        Operation operation = operationRepository.findById(eventId).orElse(null);
        if (operation == null) {
            operation = Operation.builder()
                    .eventId(event.getId())
                    .event(event)
                    .publicationStatus(Operation.PublicationStatus.DRAFT)
                    .build();
            // The operation uses the event UUID as its assigned primary key. Persist
            // the new row explicitly; merge treats this manually assigned id as a
            // detached entity and can fail before the transaction is flushed.
            entityManager.persist(operation);
        } else {
            operation.setEvent(event);
            operationRepository.save(operation);
        }
        return messageService.buildResponse("operation.draft.created", new OperationResponseDTO(event, operation));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationResponseDTO>> update(UUID eventId, OperationUpdateRequest request) {
        Event event = findOperationEvent(eventId);
        if (request.getBriefing() != null && request.getBriefing().length() > 50000) throw new IllegalArgumentException("Briefing trop long");
        if (request.getMeetingPoint() != null && request.getMeetingPoint().length() > 255) throw new IllegalArgumentException("Lieu trop long");
        if (request.getImageUrl() != null && !request.getImageUrl().isBlank()) {
            URI image = URI.create(request.getImageUrl());
            if (!("https".equalsIgnoreCase(image.getScheme()) || "http".equalsIgnoreCase(image.getScheme())) || image.getHost() == null) throw new IllegalArgumentException("URL d’image invalide");
        }
        Operation operation = operationRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Brouillon introuvable"));
        operation.setBriefing(request.getBriefing());
        if (request.getObjectives() != null && request.getObjectives().length() > 50000) throw new IllegalArgumentException("Objectifs trop longs");
        operation.setObjectives(request.getObjectives());
        operation.setMeetingPoint(request.getMeetingPoint());
        operation.setImageUrl(request.getImageUrl());
        if (request.getAllowShipProposals() != null) operation.setAllowShipProposals(request.getAllowShipProposals());
        operation.setUpdatedAt(LocalDateTime.now());
        return messageService.buildResponse("operation.updated", new OperationResponseDTO(event, operationRepository.save(operation)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationResponseDTO>> publish(UUID eventId) {
        Event event = findOperationEvent(eventId);
        Operation operation = operationRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Brouillon introuvable"));
        operation.setPublicationStatus(Operation.PublicationStatus.PUBLISHED);
        operation.setUpdatedAt(LocalDateTime.now());
        return messageService.buildResponse("operation.published", new OperationResponseDTO(event, operationRepository.save(operation)));
    }

    private Event findOperationEvent(UUID id) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (event.getActivityType() != ActivityType.OPERATION) throw new ResourceNotFoundException("Opération introuvable");
        return event;
    }
}
