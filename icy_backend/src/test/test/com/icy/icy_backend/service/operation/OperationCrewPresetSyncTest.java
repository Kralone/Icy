package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationCrewPresetRequest;
import com.icy.icy_backend.controller.dto.operation.OperationPositionRequest;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.OperationCrewPreset;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.repository.event.*;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Un preset modifié se répercute sur les équipages qui le suivent, dans les opérations à venir seulement. */
class OperationCrewPresetSyncTest {
    private final UUID presetId = UUID.randomUUID();
    private final OperationCrewPresetRepository presets = mock(OperationCrewPresetRepository.class);
    private final OperationCrewPresetPositionRepository presetPositions = mock(OperationCrewPresetPositionRepository.class);
    private final ShipRepository ships = mock(ShipRepository.class);
    private final OperationGroupRepository groups = mock(OperationGroupRepository.class);
    private final OperationGroupPositionRepository crewPositions = mock(OperationGroupPositionRepository.class);
    private final EventRepository events = mock(EventRepository.class);
    private final OperationCrewPresetService service = new OperationCrewPresetService(presets, presetPositions, ships, mock(MessageService.class));

    private OperationGroup crew(long id, LocalDateTime end, long shipModelId) {
        UUID operationId = UUID.randomUUID();
        Event event = new Event();
        event.setId(operationId);
        event.setEndDateTime(end);
        when(events.findById(operationId)).thenReturn(Optional.of(event));
        return OperationGroup.builder().id(id).operationEventId(operationId).kind(OperationGroup.Kind.CREW).shipModelId(shipModelId)
                .crewPresetId(presetId).capacity(4).positionMode(OperationGroup.PositionMode.SELF).build();
    }

    private static OperationPositionRequest position(String label, String icon, Integer capacity) {
        OperationPositionRequest request = new OperationPositionRequest();
        request.setLabel(label);
        request.setIcon(icon);
        request.setCapacity(capacity);
        return request;
    }

    @Test
    void updatesLinkedCrewsOfUpcomingOperationsAndLeavesFinishedOnesAlone() {
        service.setCrewSync(groups, crewPositions, events, null);
        Ship polaris = new Ship();
        polaris.setId(286L);
        polaris.setName("Polaris");
        when(ships.findById(286L)).thenReturn(Optional.of(polaris));
        when(presets.findById(presetId)).thenReturn(Optional.of(OperationCrewPreset.builder().id(presetId).name("Polaris — Standard").shipModelId(286L).build()));
        when(presetPositions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OperationGroup upcoming = crew(2, LocalDateTime.now().plusDays(2), 286);
        OperationGroup finished = crew(3, LocalDateTime.now().minusDays(1), 286);
        OperationGroup otherShip = crew(4, LocalDateTime.now().plusDays(2), 999);
        when(groups.findByCrewPresetId(presetId)).thenReturn(List.of(upcoming, finished, otherShip));
        OperationGroupPosition pilot = OperationGroupPosition.builder().id(10L).groupId(2L).label("Pilote").capacity(1).build();
        OperationGroupPosition gunner = OperationGroupPosition.builder().id(11L).groupId(2L).label("Artilleur").capacity(7).build();
        when(crewPositions.findByGroupIdOrderBySortOrderAscIdAsc(2L)).thenReturn(new ArrayList<>(List.of(pilot, gunner)));

        OperationCrewPresetRequest request = new OperationCrewPresetRequest();
        request.setName("Polaris — Standard");
        request.setShipModelId(286L);
        request.setCapacity(10);
        request.setPositionMode(OperationGroup.PositionMode.MANAGED);
        request.setPositions(List.of(position("pilote", "pilot", 1), position("Torpilleur", "missile", 1)));
        service.update(presetId, request);

        // « Artilleur » disparaît (ses membres restent dans l'équipage, sans poste : clé étrangère ON DELETE SET NULL).
        verify(crewPositions).delete(gunner);
        ArgumentCaptor<OperationGroupPosition> saved = ArgumentCaptor.forClass(OperationGroupPosition.class);
        verify(crewPositions, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(OperationGroupPosition::getLabel, OperationGroupPosition::getIcon, OperationGroupPosition::getSortOrder)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("pilote", "pilot", 0), org.assertj.core.groups.Tuple.tuple("Torpilleur", "missile", 1));
        assertThat(saved.getAllValues().get(0).getId()).isEqualTo(10L);
        assertThat(upcoming.getCapacity()).isEqualTo(10);
        assertThat(upcoming.getPositionMode()).isEqualTo(OperationGroup.PositionMode.MANAGED);

        // Opération terminée : rien ne change, le lien reste. Autre vaisseau : l'équipage ne suit plus le preset.
        verify(crewPositions, never()).findByGroupIdOrderBySortOrderAscIdAsc(3L);
        assertThat(finished.getCapacity()).isEqualTo(4);
        assertThat(finished.getCrewPresetId()).isEqualTo(presetId);
        assertThat(otherShip.getCrewPresetId()).isNull();
        verify(crewPositions, never()).findByGroupIdOrderBySortOrderAscIdAsc(4L);
    }
}
