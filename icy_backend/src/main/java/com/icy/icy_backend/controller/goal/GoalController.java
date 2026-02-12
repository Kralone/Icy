package com.icy.icy_backend.controller.goal;

import com.icy.icy_backend.controller.dto.goal.CreateGoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationSummaryDTO;
import com.icy.icy_backend.service.goal.GoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @PostMapping
    public ResponseEntity<Void> createGoal(@RequestBody CreateGoalDTO dto) {
        goalService.createGoal(dto);
        return ResponseEntity.ok().build();
    }

    /** ✅ UPDATE via le même DTO */
    @PutMapping("/{id}")
    public ResponseEntity<Void> updateGoal(@PathVariable Long id, @RequestBody CreateGoalDTO dto) {
        goalService.updateGoal(id, dto);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<GoalDTO>> getAllGoals() {
        return ResponseEntity.ok(goalService.getAllTopLevelGoals());
    }

    @GetMapping("/pinned")
    public GoalDTO getPinnedGoal() {
        return goalService.getPinnedGoal();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGoal(@PathVariable Long id) {
        goalService.deleteGoal(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/pin")
    public void pinGoal(@RequestBody Long goalId) {
        goalService.pinGoal(goalId);
    }

    @PostMapping("/{id}/increment")
    public void incrementGoal(@PathVariable Long id, @RequestParam("delta") int delta) {
        goalService.incrementGoal(id, delta);
    }

    @GetMapping("/{id}/participations")
    public ResponseEntity<List<GoalParticipationDTO>> getParticipations(
            @PathVariable Long id,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(goalService.getParticipations(id, limit));
    }

    @GetMapping("/{id}/participations/combined")
    public ResponseEntity<List<GoalParticipationSummaryDTO>> getCombinedParticipations(
            @PathVariable Long id,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(goalService.getCombinedParticipations(id, limit));
    }
}




