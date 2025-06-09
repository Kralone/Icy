package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.GoalDTO;
import com.icy.icy_backend.db.entity.Goal;
import com.icy.icy_backend.db.repository.GoalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoalService {

    private final GoalRepository goalRepository;

    public List<GoalDTO> getAllTopLevelGoals() {
        return goalRepository.findByParentIsNull().stream()
                .map(this::convertToDTO)
                .toList();
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
}
