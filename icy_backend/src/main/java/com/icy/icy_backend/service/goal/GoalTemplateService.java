package com.icy.icy_backend.service.goal;

import com.icy.icy_backend.controller.dto.goal.ApplyGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.CreateGoalTemplateDTO;
import com.icy.icy_backend.controller.dto.goal.GoalTemplateTreeDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalTemplateDTO;
import com.icy.icy_backend.db.entity.goal.Goal;
import com.icy.icy_backend.db.entity.goal.GoalTemplate;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.goal.GoalTemplateRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GoalTemplateService {

    private final GoalTemplateRepository goalTemplateRepository;
    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    public List<GoalTemplateDTO> getAllTopLevelTemplates() {
        List<GoalTemplate> rootTemplates = goalTemplateRepository.findByParentIsNullOrderByCreatedAtAsc();
        rootTemplates.forEach(this::loadSubTemplatesRecursively);
        return rootTemplates.stream().map(this::convertToDTO).toList();
    }

    private void loadSubTemplatesRecursively(GoalTemplate template) {
        List<GoalTemplate> subTemplates = goalTemplateRepository.findByParent(template);
        subTemplates.forEach(this::loadSubTemplatesRecursively);
        template.setSubTemplates(subTemplates);
    }

    public void createTemplate(CreateGoalTemplateDTO dto) {
        GoalTemplate template = new GoalTemplate();
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setTarget(dto.getTarget() != null ? dto.getTarget() : 1);
        template.setCreatedAt(LocalDateTime.now());

        if (dto.getParentId() != null) {
            GoalTemplate parent = goalTemplateRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Template parent introuvable"));
            template.setParent(parent);
        }

        goalTemplateRepository.save(template);
    }

    public void updateTemplate(Long id, CreateGoalTemplateDTO dto) {
        GoalTemplate template = goalTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template introuvable"));

        if (dto.getName() != null && !dto.getName().trim().isEmpty()) {
            template.setName(dto.getName().trim());
        }

        if (dto.getDescription() != null) {
            template.setDescription(dto.getDescription());
        }

        if (dto.getTarget() != null && dto.getTarget() > 0) {
            template.setTarget(dto.getTarget());
        }

        if (dto.getParentId() == null) {
            template.setParent(null);
        } else {
            if (dto.getParentId().equals(template.getId())) {
                throw new IllegalArgumentException("Un template ne peut pas être son propre parent.");
            }

            GoalTemplate parent = goalTemplateRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Template parent introuvable"));

            if (isDescendant(template, parent)) {
                throw new IllegalArgumentException("Parent invalide : cycle détecté (le parent est un descendant).");
            }

            template.setParent(parent);
        }

        goalTemplateRepository.save(template);
    }

    private boolean isDescendant(GoalTemplate template, GoalTemplate candidateParent) {
        GoalTemplate cursor = candidateParent;
        while (cursor != null) {
            if (cursor.getId().equals(template.getId())) return true;
            cursor = cursor.getParent();
        }
        return false;
    }

    public void deleteTemplate(Long id) {
        GoalTemplate template = goalTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template introuvable"));
        goalTemplateRepository.delete(template);
    }

    public void applyTemplate(Long templateId, ApplyGoalTemplateDTO dto) {
        GoalTemplate template = goalTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Template introuvable"));

        User user = null;
        if (dto != null && dto.getUserId() != null) {
            user = userRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));
        }

        Goal parentGoal = null;
        if (dto != null && dto.getParentGoalId() != null) {
            parentGoal = goalRepository.findById(dto.getParentGoalId())
                    .orElseThrow(() -> new ResourceNotFoundException("Objectif parent introuvable"));
        }

        createFromTemplate(template, parentGoal, user);
    }

    public void createTemplateTree(GoalTemplateTreeDTO dto) {
        if (dto == null) {
            throw new IllegalArgumentException("Template requis.");
        }
        createTemplateTree(dto, null);
    }

    private void createTemplateTree(GoalTemplateTreeDTO dto, GoalTemplate parent) {
        GoalTemplate template = new GoalTemplate();
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setTarget(dto.getTarget() != null ? dto.getTarget() : 1);
        template.setCreatedAt(LocalDateTime.now());
        template.setParent(parent);

        goalTemplateRepository.save(template);

        if (dto.getSubTemplates() != null) {
            for (GoalTemplateTreeDTO child : dto.getSubTemplates()) {
                createTemplateTree(child, template);
            }
        }
    }

    private void createFromTemplate(GoalTemplate template, Goal parent, User user) {
        Goal goal = new Goal();
        goal.setName(template.getName());
        goal.setDescription(template.getDescription());
        goal.setTarget(template.getTarget());
        goal.setCurrent(0);
        goal.setPinned(false);
        goal.setCompleted(false);
        goal.setCreatedAt(LocalDateTime.now());
        goal.setParent(parent);
        goal.setUser(user);

        goalRepository.save(goal);

        List<GoalTemplate> children = goalTemplateRepository.findByParent(template);
        for (GoalTemplate child : children) {
            createFromTemplate(child, goal, user);
        }
    }

    private GoalTemplateDTO convertToDTO(GoalTemplate template) {
        return GoalTemplateDTO.builder()
                .id(template.getId())
                .name(template.getName())
                .description(template.getDescription())
                .target(template.getTarget())
                .createdAt(template.getCreatedAt())
                .parentId(template.getParent() != null ? template.getParent().getId() : null)
                .subTemplates(template.getSubTemplates().stream().map(this::convertToDTO).toList())
                .build();
    }
}
