package com.icy.icy_backend.controller.goal;

import com.icy.icy_backend.controller.dto.goal.ApplyGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.CreateGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.GoalTemplateTreeDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalTemplateDTO;
import com.icy.icy_backend.service.goal.GoalTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/goal-templates")
@RequiredArgsConstructor
public class GoalTemplateController {

    private final GoalTemplateService goalTemplateService;

    @GetMapping
    public ResponseEntity<List<GoalTemplateDTO>> getAllTemplates() {
        return ResponseEntity.ok(goalTemplateService.getAllTopLevelTemplates());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> createTemplate(@RequestBody CreateGoalTemplateDTO dto) {
        goalTemplateService.createTemplate(dto);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> createTemplateBatch(@RequestBody GoalTemplateTreeDTO dto) {
        goalTemplateService.createTemplateTree(dto);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> updateTemplate(@PathVariable Long id, @RequestBody CreateGoalTemplateDTO dto) {
        goalTemplateService.updateTemplate(id, dto);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        goalTemplateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/apply")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> applyTemplate(@PathVariable Long id, @RequestBody(required = false) ApplyGoalTemplateDTO dto) {
        goalTemplateService.applyTemplate(id, dto);
        return ResponseEntity.ok().build();
    }
}
