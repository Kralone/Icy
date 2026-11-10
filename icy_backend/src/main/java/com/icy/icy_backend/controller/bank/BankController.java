package com.icy.icy_backend.controller.bank;

import com.icy.icy_backend.controller.dto.bank.BankDtos;
import com.icy.icy_backend.service.bank.BankService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Banque de guilde. Tout membre connecté lit le solde et les projets ;
 * le détail et la saisie sont vérifiés par le service (BankAccess).
 */
@RestController
@RequestMapping("/api/bank")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class BankController {
    private final BankService bank;

    @GetMapping
    public BankDtos.Overview overview() {
        return bank.overview();
    }

    @GetMapping("/details")
    public BankDtos.Details details() {
        return bank.details();
    }

    @GetMapping("/members")
    public java.util.List<BankDtos.Member> members() {
        return bank.members();
    }

    @PostMapping("/entries")
    public ResponseEntity<BankDtos.Entry> record(@RequestBody BankDtos.EntryRequest request) {
        return ResponseEntity.status(201).body(bank.record(request));
    }

    @PostMapping("/entries/{id}/cancel")
    public BankDtos.Entry cancel(@PathVariable UUID id, @RequestBody BankDtos.CancelRequest request) {
        return bank.cancel(id, request);
    }

    @PostMapping("/projects")
    public ResponseEntity<BankDtos.Project> createProject(@RequestBody BankDtos.ProjectRequest request) {
        return ResponseEntity.status(201).body(bank.createProject(request));
    }

    @PutMapping("/projects/{id}")
    public BankDtos.Project updateProject(@PathVariable UUID id, @RequestBody BankDtos.ProjectRequest request) {
        return bank.updateProject(id, request);
    }
}
