package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.CreateGoalDTO;
import com.icy.icy_backend.controller.dto.response.GoalDTO;
import com.icy.icy_backend.service.GoalService;
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

}
