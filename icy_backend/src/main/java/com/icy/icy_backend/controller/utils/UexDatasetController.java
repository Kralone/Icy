package com.icy.icy_backend.controller.utils;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.utils.UexDatasetDetailDTO;
import com.icy.icy_backend.controller.dto.utils.UexDatasetSummaryDTO;
import com.icy.icy_backend.service.uex.UexDatasetService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/utils/uex")
public class UexDatasetController {
    private final UexDatasetService uexDatasetService;

    public UexDatasetController(UexDatasetService uexDatasetService) {
        this.uexDatasetService = uexDatasetService;
    }

    @GetMapping("/datasets")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<UexDatasetSummaryDTO>>> listDatasets() {
        return uexDatasetService.listDatasets();
    }

    @GetMapping("/datasets/{datasetKey}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<UexDatasetDetailDTO>> getDataset(@PathVariable String datasetKey) {
        return uexDatasetService.getDataset(datasetKey);
    }

    @PostMapping("/datasets/{datasetKey}/refresh")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<UexDatasetDetailDTO>> refreshDataset(@PathVariable String datasetKey) {
        return uexDatasetService.refreshDataset(datasetKey);
    }
}
