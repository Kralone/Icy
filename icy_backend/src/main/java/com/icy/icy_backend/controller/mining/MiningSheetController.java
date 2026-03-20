package com.icy.icy_backend.controller.mining;

import com.icy.icy_backend.controller.dto.mining.MiningSheetCreateRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetJobUpsertRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetSaleDeclareRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetShipAddRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetUpdateRequest;
import com.icy.icy_backend.controller.dto.response.mining.MiningSheetDTO;
import com.icy.icy_backend.service.mining.MiningSheetService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/mining-sheets")
public class MiningSheetController {
    private final MiningSheetService miningSheetService;

    public MiningSheetController(MiningSheetService miningSheetService) {
        this.miningSheetService = miningSheetService;
    }

    @GetMapping
    public ResponseEntity<List<MiningSheetDTO>> listSheets() {
        return ResponseEntity.ok(miningSheetService.listSheets());
    }

    @GetMapping("/sale-locations")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<String>> suggestSaleLocations(
            @RequestParam(value = "query", required = false) String query
    ) {
        return ResponseEntity.ok(miningSheetService.suggestSaleLocations(query));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MiningSheetDTO> createSheet(@RequestBody MiningSheetCreateRequest request) {
        return ResponseEntity.ok(miningSheetService.createSheet(request));
    }

    @PutMapping("/{sheetId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MiningSheetDTO> updateSheet(
            @PathVariable UUID sheetId,
            @RequestBody MiningSheetUpdateRequest request
    ) {
        return ResponseEntity.ok(miningSheetService.updateSheet(sheetId, request));
    }

    @PostMapping("/{sheetId}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MiningSheetDTO> lockSheet(@PathVariable UUID sheetId) {
        return ResponseEntity.ok(miningSheetService.lockSheet(sheetId));
    }

    @PostMapping("/{sheetId}/unlock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MiningSheetDTO> unlockSheet(@PathVariable UUID sheetId) {
        return ResponseEntity.ok(miningSheetService.unlockSheet(sheetId));
    }

    @PostMapping("/{sheetId}/finalize")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MiningSheetDTO> finalizeSheet(@PathVariable UUID sheetId) {
        return ResponseEntity.ok(miningSheetService.finalizeSheet(sheetId));
    }

    @PostMapping("/{sheetId}/jobs")
    public ResponseEntity<MiningSheetDTO> createJob(
            @PathVariable UUID sheetId,
            @RequestBody MiningSheetJobUpsertRequest request
    ) {
        return ResponseEntity.ok(miningSheetService.createJob(sheetId, request));
    }

    @PutMapping("/{sheetId}/jobs/{jobId}")
    public ResponseEntity<MiningSheetDTO> updateJob(
            @PathVariable UUID sheetId,
            @PathVariable UUID jobId,
            @RequestBody MiningSheetJobUpsertRequest request
    ) {
        return ResponseEntity.ok(miningSheetService.updateJob(sheetId, jobId, request));
    }

    @DeleteMapping("/{sheetId}/jobs/{jobId}")
    public ResponseEntity<MiningSheetDTO> deleteJob(
            @PathVariable UUID sheetId,
            @PathVariable UUID jobId
    ) {
        return ResponseEntity.ok(miningSheetService.deleteJob(sheetId, jobId));
    }

    @PostMapping("/{sheetId}/ships")
    public ResponseEntity<MiningSheetDTO> addShipToSheet(
            @PathVariable UUID sheetId,
            @RequestBody MiningSheetShipAddRequest request
    ) {
        Long shipId = request == null ? null : request.shipId();
        return ResponseEntity.ok(miningSheetService.addShip(sheetId, shipId));
    }

    @DeleteMapping("/{sheetId}/ships/{sheetShipId}")
    public ResponseEntity<MiningSheetDTO> removeShipFromSheet(
            @PathVariable UUID sheetId,
            @PathVariable UUID sheetShipId
    ) {
        return ResponseEntity.ok(miningSheetService.removeShip(sheetId, sheetShipId));
    }

    @PostMapping("/{sheetId}/sales")
    public ResponseEntity<MiningSheetDTO> declareSale(
            @PathVariable UUID sheetId,
            @RequestBody MiningSheetSaleDeclareRequest request
    ) {
        Long creditAuec = request == null ? null : request.creditAuec();
        return ResponseEntity.ok(miningSheetService.declareSale(sheetId, creditAuec));
    }
}
