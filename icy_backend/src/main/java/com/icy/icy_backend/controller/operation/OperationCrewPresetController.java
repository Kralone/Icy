package com.icy.icy_backend.controller.operation;

import com.icy.icy_backend.controller.dto.operation.OperationCrewPresetRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationCrewPresetDTO;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.operation.OperationCrewPresetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Bibliothèque de presets d'équipage : lecture pour les organisateurs, écriture réservée aux administrateurs. */
@RestController
@RequestMapping("/api/operations/crew-presets")
@RequiredArgsConstructor
public class OperationCrewPresetController {
    private final OperationCrewPresetService presetService;
    private final MessageService messageService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<OperationCrewPresetDTO>>> list(@RequestParam(required = false) Long shipModelId,
                                                                               @RequestParam(defaultValue = "false") boolean includeArchived) {
        return messageService.buildResponse("operation.crew.presets", presetService.list(shipModelId, includeArchived));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse<OperationCrewPresetDTO>> create(@RequestBody OperationCrewPresetRequest request) {
        return presetService.create(request);
    }

    @PutMapping("/{presetId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse<OperationCrewPresetDTO>> update(@PathVariable UUID presetId, @RequestBody OperationCrewPresetRequest request) {
        return presetService.update(presetId, request);
    }

    @DeleteMapping("/{presetId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse<Void>> archive(@PathVariable UUID presetId) {
        return presetService.setArchived(presetId, true);
    }

    @PostMapping("/{presetId}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse<Void>> restore(@PathVariable UUID presetId) {
        return presetService.setArchived(presetId, false);
    }
}
