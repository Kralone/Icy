package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.CreateGoalDTO;
import com.icy.icy_backend.controller.dto.response.GoalDTO;
import com.icy.icy_backend.db.entity.Goal;
import com.icy.icy_backend.db.repository.GoalRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoalService {

    private final GoalRepository goalRepository;

    public List<GoalDTO> getAllTopLevelGoals() {
        List<Goal> rootGoals = goalRepository.findByParentIsNullOrderByPinnedDescCreatedAtAsc();
        rootGoals.forEach(this::loadSubGoalsRecursively);
        return rootGoals.stream().map(this::convertToDTO).toList();
    }

    private void loadSubGoalsRecursively(Goal goal) {
        List<Goal> subGoals = goalRepository.findByParent(goal);
        subGoals.forEach(this::loadSubGoalsRecursively);
        goal.setSubGoals(subGoals);
    }

    public void createGoal(CreateGoalDTO dto) {
        Goal goal = new Goal();
        goal.setName(dto.getName());
        goal.setDescription(dto.getDescription());
        goal.setTarget(dto.getTarget());
        goal.setCurrent(0);
        goal.setCreatedAt(LocalDateTime.now());
        goal.setPinned(false);
        goal.setCompleted(false);

        if (dto.getParentId() != null) {
            Goal parent = goalRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Objectif parent introuvable"));
            goal.setParent(parent);
        }

        goalRepository.save(goal);
        log.info("Objectif créé : {}", goal.getName());
    }

    private GoalDTO convertToDTO(Goal goal) {
        return GoalDTO.builder()
                .id(goal.getId())
                .name(goal.getName())
                .description(goal.getDescription())
                .target(goal.getTarget())
                .current(goal.getCurrent())
                .pinned(goal.isPinned())
                .completed(goal.isCompleted())
                .createdAt(goal.getCreatedAt())
                .parentId(goal.getParent() != null ? goal.getParent().getId() : null)
                .subGoals(goal.getSubGoals().stream().map(this::convertToDTO).toList())
                .build();
    }

    public void deleteGoal(Long id) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));
        goalRepository.delete(goal);
        log.info("Objectif supprimé : {}", goal.getName());
    }

    public GoalDTO getPinnedGoal() {
        Goal pinned = goalRepository.findFirstByPinnedTrue()
                .orElseThrow(() -> new ResourceNotFoundException("Aucun objectif épinglé trouvé"));
        loadSubGoalsRecursively(pinned);
        return convertToDTO(pinned);
    }

    public void pinGoal(Long id) {
        Goal goalToPin = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif à épingler introuvable"));

        // Désépingler l’actuel s’il existe
        goalRepository.findFirstByPinnedTrue()
                .filter(g -> !g.getId().equals(id))
                .ifPresent(g -> {
                    g.setPinned(false);
                    goalRepository.save(g);
                });

        goalToPin.setPinned(true);
        goalRepository.save(goalToPin);
        log.info("Objectif épinglé : {}", goalToPin.getName());
    }


    public void incrementGoal(Long id, int delta) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));

        int newCurrent = goal.getCurrent() + delta;
        goal.setCurrent(Math.max(0, newCurrent)); // Jamais négatif
        goal.setCompleted(goal.getCurrent() >= goal.getTarget());

        goalRepository.save(goal);
        log.info("Objectif {} modifié de {}", goal.getName(), delta);
    }



}
