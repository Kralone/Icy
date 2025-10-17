package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.RecruitmentDTO;
import com.icy.icy_backend.service.RecruitmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {

    private final RecruitmentService recruitmentService;

    public RecruitmentController(RecruitmentService recruitmentService) {
        this.recruitmentService = recruitmentService;
    }

    @PostMapping
    public ResponseEntity<RecruitmentDTO> create(@RequestBody RecruitmentDTO recruitment) {
        return ResponseEntity.ok(recruitmentService.create(recruitment));
    }

    @GetMapping
    public ResponseEntity<List<RecruitmentDTO>> getAll() {
        return ResponseEntity.ok(recruitmentService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecruitmentDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(recruitmentService.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecruitmentDTO> update(@PathVariable Long id, @RequestBody RecruitmentDTO recruitment) {
        return ResponseEntity.ok(recruitmentService.update(id, recruitment));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        recruitmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
