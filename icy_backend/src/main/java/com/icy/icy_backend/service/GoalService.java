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

        // ✅ création = toujours 0 + non pinned (comme tu l’as demandé)
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

    /** ✅ UPDATE via CreateGoalDTO */
    public void updateGoal(Long id, CreateGoalDTO dto) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));

        // ----- champs simples -----
        if (dto.getName() != null && !dto.getName().trim().isEmpty()) {
            goal.setName(dto.getName().trim());
        }

        // null => ne touche pas, vide => autorisé (tu peux vouloir effacer)
        if (dto.getDescription() != null) {
            goal.setDescription(dto.getDescription());
        }

        if (dto.getTarget() != null && dto.getTarget() > 0) {
            goal.setTarget(dto.getTarget());
        }

        // current éditable (admin)
        if (dto.getCurrent() != null) {
            goal.setCurrent(Math.max(0, dto.getCurrent()));
        }

        // ----- parent -----
        // null => root
        if (dto.getParentId() == null) {
            goal.setParent(null);
        } else {
            if (dto.getParentId().equals(goal.getId())) {
                throw new IllegalArgumentException("Un objectif ne peut pas être son propre parent.");
            }

            Goal parent = goalRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Objectif parent introuvable"));

            // Evite les cycles : parent ne doit pas être un descendant du goal
            if (isDescendant(goal, parent)) {
                throw new IllegalArgumentException("Parent invalide : cycle détecté (le parent est un descendant).");
            }

            goal.setParent(parent);
        }

        // ----- pinned (admin) -----
        // Règle : un seul pinned global (comme pinGoal())
        if (dto.getPinned() != null) {
            boolean wantsPinned = dto.getPinned();

            if (wantsPinned) {
                goalRepository.findFirstByPinnedTrue()
                        .filter(g -> !g.getId().equals(goal.getId()))
                        .ifPresent(g -> {
                            g.setPinned(false);
                            goalRepository.save(g);
                        });
            }

            goal.setPinned(wantsPinned);
        }

        // ----- completed recalculé -----
        goal.setCompleted(goal.getCurrent() >= goal.getTarget());

        goalRepository.save(goal);
        log.info("Objectif mis à jour : {}", goal.getName());
    }

    /**
     * Retourne true si candidateParent est dans la chaîne des parents de goal
     * (cycle : goal devient ancêtre de son propre parent).
     */
    private boolean isDescendant(Goal goal, Goal candidateParent) {
        Goal cursor = candidateParent;
        while (cursor != null) {
            if (cursor.getId().equals(goal.getId())) return true;
            cursor = cursor.getParent();
        }
        return false;
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
        goal.setCurrent(Math.max(0, newCurrent));
        goal.setCompleted(goal.getCurrent() >= goal.getTarget());

        goalRepository.save(goal);
        log.info("Objectif {} modifié de {}", goal.getName(), delta);
    }
}
