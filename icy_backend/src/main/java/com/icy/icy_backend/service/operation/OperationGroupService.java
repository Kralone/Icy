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
import java.util.List;
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
        if (request.getAssignmentMode() == null) throw new IllegalArgumentException("Mode d’affectation requis");
        if (request.getSortOrder() < 0 || request.getSortOrder() > 10000) throw new IllegalArgumentException("Ordre invalide");
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (request.getParentId() != null) {
            OperationGroup parent = groupRepository.findById(request.getParentId()).orElseThrow(() -> new ResourceNotFoundException("Groupe parent introuvable"));
            if (!operationId.equals(parent.getOperationEventId())) throw new IllegalArgumentException("Le groupe parent appartient à une autre opération");
            if (parent.getParentId() != null) throw new IllegalArgumentException("Deux niveaux de groupes maximum");
        }
        OperationGroup group = OperationGroup.builder().operationEventId(operationId).parentId(request.getParentId()).name(request.getName().trim()).description(request.getDescription()).capacity(request.getCapacity()).assignmentMode(request.getAssignmentMode()).sortOrder(request.getSortOrder()).build();
        return messageService.buildResponse("operation.group.created", new OperationGroupResponseDTO(groupRepository.save(group)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> update(UUID operationId, Long groupId, OperationGroupRequest request) {
        OperationGroup group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId())) throw new ResourceNotFoundException("Groupe introuvable");
        if (request.getName() == null || request.getName().isBlank() || request.getName().length() > 120) throw new IllegalArgumentException("Nom de groupe invalide");
        if (request.getDescription() != null && request.getDescription().length() > 5000) throw new IllegalArgumentException("Description trop longue");
        if (request.getCapacity() != null && (request.getCapacity() < 0 || request.getCapacity() > 10000)) throw new IllegalArgumentException("Capacité invalide");
        if (request.getAssignmentMode() == null) throw new IllegalArgumentException("Mode d’affectation requis");
        if (request.getSortOrder() < 0 || request.getSortOrder() > 10000) throw new IllegalArgumentException("Ordre invalide");
        if (request.getParentId() != null) {
            OperationGroup parent = groupRepository.findById(request.getParentId()).orElseThrow(() -> new ResourceNotFoundException("Groupe parent introuvable"));
            if (!operationId.equals(parent.getOperationEventId()) || groupId.equals(parent.getId()) || parent.getParentId() != null) throw new IllegalArgumentException("Groupe parent invalide");
        }
        group.setName(request.getName().trim()); group.setDescription(request.getDescription()); group.setCapacity(request.getCapacity());
        group.setParentId(request.getParentId()); group.setAssignmentMode(request.getAssignmentMode()); group.setSortOrder(request.getSortOrder());
        return messageService.buildResponse("operation.group.updated", new OperationGroupResponseDTO(groupRepository.save(group)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> delete(UUID operationId, Long groupId) {
        OperationGroup group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId())) throw new ResourceNotFoundException("Groupe introuvable");
        if (groupRepository.existsByParentId(groupId)) throw new IllegalStateException("Supprimez d’abord les sous-groupes");
        groupRepository.delete(group);
        return messageService.buildResponse("operation.group.deleted", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> reorder(UUID operationId, List<Long> groupIds) {
        if (groupIds == null || groupIds.isEmpty() || groupIds.size() > 100 || groupIds.stream().anyMatch(java.util.Objects::isNull) || groupIds.stream().distinct().count() != groupIds.size()) {
            throw new IllegalArgumentException("Ordre de groupes invalide");
        }
        List<OperationGroup> groups = groupIds.stream().map(id -> groupRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"))).toList();
        if (groups.stream().anyMatch(group -> !operationId.equals(group.getOperationEventId()))) throw new IllegalArgumentException("Les groupes appartiennent à une autre opération");
        Long expectedParent = groups.get(0).getParentId();
        if (groups.stream().anyMatch(group -> !java.util.Objects.equals(expectedParent, group.getParentId()))) throw new IllegalArgumentException("Seuls les groupes frères peuvent être réordonnés");
        for (int index = 0; index < groups.size(); index++) { groups.get(index).setSortOrder(index); groupRepository.save(groups.get(index)); }
        return messageService.buildResponse("operation.group.reordered", null);
    }
}
