package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.OperationCrewPreset;
import com.icy.icy_backend.db.entity.event.OperationCrewPresetPosition;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Aligne un équipage sur un preset : postes rapprochés par leur nom, mis à jour, ajoutés ou supprimés ; capacité et attribution des postes suivent.
 * Les membres d'un poste supprimé restent dans l'équipage, sans poste (clé étrangère ON DELETE SET NULL).
 */
@Component
@RequiredArgsConstructor
public class CrewPresetApplier {
    private final OperationGroupRepository groupRepository;
    private final OperationGroupPositionRepository positionRepository;

    void apply(OperationGroup crew, OperationCrewPreset preset, List<OperationCrewPresetPosition> positions) {
        groupRepository.findLockedById(crew.getId());
        Map<String, OperationGroupPosition> existing = positionRepository.findByGroupIdOrderBySortOrderAscIdAsc(crew.getId()).stream()
                .collect(Collectors.toMap(position -> key(position.getLabel()), Function.identity(), (first, second) -> first));
        Set<String> wanted = positions.stream().map(position -> key(position.getLabel())).collect(Collectors.toSet());
        // Suppressions d'abord : un nom libéré peut être repris juste après sans heurter l'unicité des noms.
        existing.entrySet().stream().filter(entry -> !wanted.contains(entry.getKey())).map(Map.Entry::getValue).toList()
                .forEach(positionRepository::delete);
        positionRepository.flush();
        for (OperationCrewPresetPosition source : positions) {
            OperationGroupPosition target = existing.get(key(source.getLabel()));
            if (target == null) target = OperationGroupPosition.builder().groupId(crew.getId()).build();
            target.setLabel(source.getLabel());
            target.setIcon(source.getIcon());
            target.setCapacity(source.getCapacity());
            target.setSortOrder(source.getSortOrder());
            positionRepository.save(target);
        }
        crew.setCrewPresetId(preset.getId());
        crew.setCapacity(preset.getCapacity());
        crew.setPositionMode(preset.getPositionMode());
        groupRepository.save(crew);
    }

    private static String key(String label) {
        return label.trim().toLowerCase(Locale.ROOT);
    }
}
