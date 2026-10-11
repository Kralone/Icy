package com.icy.icy_backend.service.operation;
import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationGroupResponseDTO;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
@Service @RequiredArgsConstructor
public class OperationGroupService {
    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final MessageService messageService;
    @Transactional
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> create(UUID operationId, OperationGroupRequest request) {
        if (request.getName() == null || request.getName().isBlank() || request.getName().length() > 120) throw new IllegalArgumentException("Nom de groupe invalide");
        if (request.getDescription() != null && request.getDescription().length() > 5000) throw new IllegalArgumentException("Description trop longue");
        if (request.getCapacity() != null && (request.getCapacity() < 0 || request.getCapacity() > 10000)) throw new IllegalArgumentException("Capacité invalide");
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (request.getParentId() != null) {
            OperationGroup parent = groupRepository.findById(request.getParentId()).orElseThrow(() -> new ResourceNotFoundException("Groupe parent introuvable"));
            if (!operationId.equals(parent.getOperationEventId())) throw new IllegalArgumentException("Le groupe parent appartient à une autre opération");
            if (parent.getParentId() != null) throw new IllegalArgumentException("Deux niveaux de groupes maximum");
        }
        OperationGroup group = OperationGroup.builder().operationEventId(operationId).parentId(request.getParentId()).name(request.getName().trim()).description(request.getDescription()).capacity(request.getCapacity()).assignmentMode(request.getAssignmentMode()).sortOrder(request.getSortOrder()).build();
        return messageService.buildResponse("operation.group.created", new OperationGroupResponseDTO(groupRepository.save(group)));
    }
}
