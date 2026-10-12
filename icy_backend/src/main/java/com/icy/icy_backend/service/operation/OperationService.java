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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
    private final ObjectMapper objectMapper;

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
            URI image;
            try {
                image = URI.create(request.getImageUrl());
            } catch (IllegalArgumentException exception) {
                throw new IllegalArgumentException("URL d’image invalide");
            }
            if (!("https".equalsIgnoreCase(image.getScheme()) || "http".equalsIgnoreCase(image.getScheme())) || image.getHost() == null) throw new IllegalArgumentException("URL d’image invalide");
        }
        Operation operation = operationRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Brouillon introuvable"));
        if (request.getExpectedRevision() != null && request.getExpectedRevision() != operation.getRevision()) {
            throw new ObjectOptimisticLockingFailureException(Operation.class, eventId);
        }
        operation.setBriefing(request.getBriefing());
        validateObjectives(request.getObjectives());
        operation.setObjectives(request.getObjectives());
        operation.setMeetingPoint(request.getMeetingPoint());
        operation.setImageUrl(request.getImageUrl());
        if (request.getAllowShipProposals() != null) operation.setAllowShipProposals(request.getAllowShipProposals());
        operation.setUpdatedAt(LocalDateTime.now());
        Operation saved = operationRepository.save(operation);
        // Écrit maintenant pour renvoyer la révision réellement enregistrée.
        entityManager.flush();
        return messageService.buildResponse("operation.updated", new OperationResponseDTO(event, saved));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationResponseDTO>> publish(UUID eventId) {
        Event event = findOperationEvent(eventId);
        Operation operation = operationRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Brouillon introuvable"));
        operation.setPublicationStatus(Operation.PublicationStatus.PUBLISHED);
        operation.setUpdatedAt(LocalDateTime.now());
        Operation saved = operationRepository.save(operation);
        // Même raison que pour update : l'éditeur poursuit à partir de la révision renvoyée.
        entityManager.flush();
        return messageService.buildResponse("operation.published", new OperationResponseDTO(event, saved));
    }

    private Event findOperationEvent(UUID id) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (event.getActivityType() != ActivityType.OPERATION) throw new ResourceNotFoundException("Opération introuvable");
        return event;
    }

    private void validateObjectives(String value) {
        if (value == null) return;
        if (value.length() > 50000) throw new IllegalArgumentException("Objectifs trop longs");
        String trimmed = value.trim();
        if (trimmed.isEmpty() || !trimmed.startsWith("[")) return;
        try {
            JsonNode root = objectMapper.readTree(trimmed);
            if (!root.isArray() || root.size() > 100) throw new IllegalArgumentException("Format d’objectifs invalide");
            for (JsonNode item : root) {
                String kind = item.path("kind").asText("");
                String text = item.path("text").asText("").trim();
                if (!item.isObject() || !("PRINCIPAL".equals(kind) || "SECONDAIRE".equals(kind)) || text.isEmpty() || text.length() > 1000) {
                    throw new IllegalArgumentException("Objectif invalide");
                }
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Format d’objectifs invalide", exception);
        }
    }
}
