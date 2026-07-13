package com.icy.icy_backend.controller.recruitment;

import com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO;
import com.icy.icy_backend.service.recruitment.RecruitmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @GetMapping
    public ResponseEntity<List<RecruitmentDTO>> getAll() {
        return ResponseEntity.ok(recruitmentService.getAll());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @GetMapping("/{id}")
    public ResponseEntity<RecruitmentDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(recruitmentService.getById(id));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/{id}")
    public ResponseEntity<RecruitmentDTO> update(@PathVariable Long id, @RequestBody RecruitmentDTO recruitment) {
        return ResponseEntity.ok(recruitmentService.update(id, recruitment));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        recruitmentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PatchMapping("/{id}/accept")
    public ResponseEntity<Void> acceptRecruitment(@PathVariable Long id) {
        recruitmentService.updateStatus(id, "ACCEPTED");
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PatchMapping("/{id}/refuse")
    public ResponseEntity<Void> refuseRecruitment(@PathVariable Long id) {
        recruitmentService.updateStatus(id, "REFUSED");
        return ResponseEntity.ok().build();
    }

}




