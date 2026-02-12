package com.icy.icy_backend.service.goal;

import com.icy.icy_backend.controller.dto.goal.CreateGoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationDTO;
import com.icy.icy_backend.controller.dto.response.goal.GoalParticipationSummaryDTO;
import com.icy.icy_backend.db.entity.goal.Goal;
import com.icy.icy_backend.db.entity.goal.GoalParticipation;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.goal.GoalParticipationRepository;
import com.icy.icy_backend.db.repository.goal.GoalRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.notification.NotificationPushService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoalService {

    private final GoalRepository goalRepository;
    private final GoalParticipationRepository goalParticipationRepository;
    private final UserRepository userRepository;
    private final NotificationPushService notificationPushService;

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

        if (dto.getUserId() != null) {
            User user = userRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));
            goal.setUser(user);
        }

        if (dto.getParentId() != null) {
            Goal parent = goalRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Objectif parent introuvable"));
            goal.setParent(parent);
        }

        goalRepository.save(goal);
        log.info("Objectif créé : {}", goal.getName());
        notificationPushService.sendBroadcast(
                "Objectif : cree",
                goal.getName(),
                "/icy/goals",
                1
        );
    }

    /** ✅ UPDATE via CreateGoalDTO */
    public void updateGoal(Long id, CreateGoalDTO dto) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));
        boolean wasCompleted = goal.isCompleted();
        boolean wasPinned = goal.isPinned();

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

        // ----- user -----
        if (dto.getUserId() == null) {
            goal.setUser(null);
        } else {
            User user = userRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));
            goal.setUser(user);
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

        if (wasPinned != goal.isPinned()) {
            notificationPushService.sendBroadcast(
                    "Objectif epingle : mis a jour",
                    goal.getName(),
                    "/icy/goals",
                    1
            );
        }
        if (!wasCompleted && goal.isCompleted()) {
            notifyGoalCompleted(goal);
        }
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
                .userId(goal.getUser() != null ? goal.getUser().getId() : null)
                .username(goal.getUser() != null ? goal.getUser().getUsername() : null)
                .avatarUrl(goal.getUser() != null ? goal.getUser().getAvatarUrl() : null)
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
        notificationPushService.sendBroadcast(
                "Objectif epingle : mis a jour",
                goalToPin.getName(),
                "/icy/goals",
                1
        );
    }

    public void incrementGoal(Long id, int delta) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));

        boolean wasCompleted = goal.isCompleted();
        int newCurrent = goal.getCurrent() + delta;
        goal.setCurrent(Math.max(0, newCurrent));
        goal.setCompleted(goal.getCurrent() >= goal.getTarget());

        goalRepository.save(goal);
        saveParticipation(goal, delta);
        log.info("Objectif {} modifié de {}", goal.getName(), delta);

        if (!wasCompleted && goal.isCompleted()) {
            notifyGoalCompleted(goal);
        }
    }

    private void notifyGoalCompleted(Goal goal) {
        String body;
        String title;
        if (goal.getParent() != null) {
            body = "Le sous-objectif \"" + goal.getName()
                    + "\" de l'objectif \"" + goal.getParent().getName()
                    + "\" est complete.";
            title = "Sous-objectif : termine";
        } else {
            body = "L'objectif \"" + goal.getName() + "\" est complete.";
            title = "Objectif : termine";
        }

        notificationPushService.sendBroadcast(title, body, "/icy/goals", 2);
    }

    public List<GoalParticipationDTO> getParticipations(Long goalId, int limit) {
        if (!goalRepository.existsById(goalId)) {
            throw new ResourceNotFoundException("Objectif introuvable");
        }

        var page = PageRequest.of(0, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "createdAt"));
        return goalParticipationRepository.findByGoal_Id(goalId, page)
                .stream()
                .map(this::convertParticipationToDTO)
                .toList();
    }

    public List<GoalParticipationSummaryDTO> getCombinedParticipations(Long goalId, int limit) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new ResourceNotFoundException("Objectif introuvable"));
        loadSubGoalsRecursively(goal);

        List<Long> goalIds = new ArrayList<>();
        collectGoalIds(goal, goalIds);

        int totalCurrent = getTotalCurrent(goal);
        Map<UUID, GoalParticipationSummaryDTO> summaries = new HashMap<>();

        for (GoalParticipation participation : goalParticipationRepository.findByGoal_IdIn(goalIds)) {
            User user = participation.getUser();
            GoalParticipationSummaryDTO existing = summaries.get(user.getId());
            if (existing == null) {
                existing = GoalParticipationSummaryDTO.builder()
                        .userId(user.getId())
                        .username(user.getUsername())
                        .avatarUrl(user.getAvatarUrl())
                        .totalDelta(0)
                        .percentOfCurrent(0)
                        .build();
                summaries.put(user.getId(), existing);
            }
            existing.setTotalDelta(existing.getTotalDelta() + participation.getDelta());
        }

        List<GoalParticipationSummaryDTO> result = summaries.values().stream()
                .sorted((a, b) -> Integer.compare(b.getTotalDelta(), a.getTotalDelta()))
                .toList();

        int max = Math.max(1, limit);
        List<GoalParticipationSummaryDTO> limited = result.size() > max ? result.subList(0, max) : result;

        int totalDelta = limited.stream().mapToInt(GoalParticipationSummaryDTO::getTotalDelta).sum();
        if (totalDelta > 0) {
            for (GoalParticipationSummaryDTO summary : limited) {
                double percent = (summary.getTotalDelta() * 100.0) / totalDelta;
                summary.setPercentOfCurrent(percent);
            }
        }

        return limited;
    }

    private void saveParticipation(Goal goal, int delta) {
        if (delta == 0) return;

        UUID userId = AuthUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));

        GoalParticipation participation = goalParticipationRepository
                .findByGoal_IdAndUser_Id(goal.getId(), userId)
                .orElseGet(() -> GoalParticipation.builder()
                        .goal(goal)
                        .user(user)
                        .delta(0)
                        .createdAt(LocalDateTime.now())
                        .build());

        participation.setDelta(participation.getDelta() + delta);
        participation.setTotalAfter(goal.getCurrent());
        if (participation.getCreatedAt() == null) {
            participation.setCreatedAt(LocalDateTime.now());
        }
        goalParticipationRepository.save(participation);
    }

    private GoalParticipationDTO convertParticipationToDTO(GoalParticipation participation) {
        return GoalParticipationDTO.builder()
                .id(participation.getId())
                .goalId(participation.getGoal().getId())
                .userId(participation.getUser().getId())
                .username(participation.getUser().getUsername())
                .avatarUrl(participation.getUser().getAvatarUrl())
                .delta(participation.getDelta())
                .totalAfter(participation.getTotalAfter())
                .createdAt(participation.getCreatedAt())
                .build();
    }

    private void collectGoalIds(Goal goal, List<Long> goalIds) {
        goalIds.add(goal.getId());
        if (goal.getSubGoals() == null) return;
        for (Goal child : goal.getSubGoals()) {
            collectGoalIds(child, goalIds);
        }
    }

    private int getTotalCurrent(Goal goal) {
        if (goal.getSubGoals() == null || goal.getSubGoals().isEmpty()) {
            return goal.getCurrent();
        }
        return goal.getSubGoals().stream()
                .mapToInt(this::getTotalCurrent)
                .sum();
    }
}






