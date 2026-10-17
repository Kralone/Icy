package com.icy.icy_backend.controller.session;

import com.icy.icy_backend.controller.dto.session.SaleSuggestionDTO;
import com.icy.icy_backend.controller.dto.session.SessionRequests;
import com.icy.icy_backend.controller.dto.session.SessionSheetDTO;
import com.icy.icy_backend.controller.dto.session.SessionSummaryDTO;
import com.icy.icy_backend.service.session.MiningMarketService;
import com.icy.icy_backend.service.session.SessionSettlementService;
import com.icy.icy_backend.service.session.SessionSheetService;
import com.icy.icy_backend.service.session.SessionSuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Fiches de minage V3 (docs/mining-v3/SPEC.md, « API »). Tout membre connecté lit les fiches ;
 * les droits d'écriture (participant, organisateur, receveur) sont vérifiés par les services.
 */
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SessionController {
    private final SessionSheetService sheets;
    private final SessionSettlementService settlements;
    private final SessionSuggestionService suggestions;
    private final MiningMarketService market;

    @GetMapping
    public List<SessionSummaryDTO> list() {
        return sheets.list();
    }

    /** Raffineries, méthodes, minerais raffinés et terminaux de vente connus d'UEX. */
    @GetMapping("/reference")
    public MiningMarketService.Reference reference() {
        return market.reference();
    }

    @GetMapping("/by-operation/{operationEventId}")
    public Map<String, UUID> byOperation(@PathVariable UUID operationEventId) {
        return Map.of("sheetId", sheets.findByOperation(operationEventId));
    }

    @GetMapping("/{id}")
    public SessionSheetDTO get(@PathVariable UUID id) {
        return sheets.get(id);
    }

    @PostMapping
    public ResponseEntity<SessionSheetDTO> create(@RequestBody SessionRequests.CreateSheet request) {
        return ResponseEntity.status(201).body(sheets.create(request));
    }

    @PutMapping("/{id}")
    public SessionSheetDTO update(@PathVariable UUID id, @RequestBody SessionRequests.UpdateSheet request) {
        return sheets.update(id, request);
    }

    @PutMapping("/{id}/participants")
    public SessionSheetDTO participants(@PathVariable UUID id, @RequestBody SessionRequests.Participants request) {
        return sheets.setParticipants(id, request);
    }

    @PostMapping("/{id}/expenses")
    public SessionSheetDTO addExpense(@PathVariable UUID id, @RequestBody SessionRequests.Expense request) {
        return sheets.addExpense(id, request);
    }

    @PutMapping("/{id}/expenses/{expenseId}")
    public SessionSheetDTO updateExpense(@PathVariable UUID id, @PathVariable UUID expenseId, @RequestBody SessionRequests.Expense request) {
        return sheets.updateExpense(id, expenseId, request);
    }

    @DeleteMapping("/{id}/expenses/{expenseId}")
    public SessionSheetDTO deleteExpense(@PathVariable UUID id, @PathVariable UUID expenseId) {
        return sheets.deleteExpense(id, expenseId);
    }

    @PostMapping("/{id}/refinery-orders")
    public SessionSheetDTO addOrder(@PathVariable UUID id, @RequestBody SessionRequests.RefineryOrder request) {
        return sheets.addOrder(id, request);
    }

    @PutMapping("/{id}/refinery-orders/{orderId}")
    public SessionSheetDTO updateOrder(@PathVariable UUID id, @PathVariable UUID orderId, @RequestBody SessionRequests.RefineryOrder request) {
        return sheets.updateOrder(id, orderId, request);
    }

    @DeleteMapping("/{id}/refinery-orders/{orderId}")
    public SessionSheetDTO deleteOrder(@PathVariable UUID id, @PathVariable UUID orderId) {
        return sheets.deleteOrder(id, orderId);
    }

    @PostMapping("/{id}/refinery-orders/{orderId}/handover")
    public SessionSheetDTO handOver(@PathVariable UUID id, @PathVariable UUID orderId) {
        return sheets.handOver(id, orderId, true);
    }

    @DeleteMapping("/{id}/refinery-orders/{orderId}/handover")
    public SessionSheetDTO cancelHandOver(@PathVariable UUID id, @PathVariable UUID orderId) {
        return sheets.handOver(id, orderId, false);
    }

    @PostMapping("/{id}/sales")
    public SessionSheetDTO addSale(@PathVariable UUID id, @RequestBody SessionRequests.Sale request) {
        return sheets.addSale(id, request);
    }

    @PutMapping("/{id}/sales/{saleId}")
    public SessionSheetDTO updateSale(@PathVariable UUID id, @PathVariable UUID saleId, @RequestBody SessionRequests.Sale request) {
        return sheets.updateSale(id, saleId, request);
    }

    @DeleteMapping("/{id}/sales/{saleId}")
    public SessionSheetDTO deleteSale(@PathVariable UUID id, @PathVariable UUID saleId) {
        return sheets.deleteSale(id, saleId);
    }

    @GetMapping("/{id}/sale-suggestions")
    public SaleSuggestionDTO saleSuggestions(@PathVariable UUID id) {
        return suggestions.suggestions(id);
    }

    @PostMapping("/{id}/settle")
    public SessionSheetDTO settle(@PathVariable UUID id) {
        return settlements.settle(id);
    }

    @PostMapping("/{id}/reopen")
    public SessionSheetDTO reopen(@PathVariable UUID id, @RequestBody SessionRequests.Reopen request) {
        return settlements.reopen(id, request.target(), request.reason());
    }

    @PostMapping("/{id}/close")
    public SessionSheetDTO close(@PathVariable UUID id, @RequestBody SessionRequests.Reason request) {
        return settlements.forceClose(id, request.reason());
    }

    @PostMapping("/{id}/transfers/{transferId}/received")
    public SessionSheetDTO confirmReceipt(@PathVariable UUID id, @PathVariable UUID transferId) {
        return settlements.confirmReceipt(id, transferId);
    }

    @DeleteMapping("/{id}/transfers/{transferId}/received")
    public SessionSheetDTO withdrawReceipt(@PathVariable UUID id, @PathVariable UUID transferId) {
        return settlements.withdrawReceipt(id, transferId);
    }
}
