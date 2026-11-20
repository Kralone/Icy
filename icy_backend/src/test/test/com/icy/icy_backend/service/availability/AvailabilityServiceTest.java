package com.icy.icy_backend.service.availability;

import com.icy.icy_backend.controller.dto.availability.AvailabilityDtos;
import com.icy.icy_backend.db.entity.availability.UserAvailabilitySlot;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.availability.UserAvailabilityRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mockito;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AvailabilityServiceTest {
    private final UUID userId = UUID.randomUUID();
    private UserAvailabilityRepository slots;
    private UserRepository users;
    private AvailabilityService service;

    @BeforeEach
    void setUp() {
        slots = Mockito.mock(UserAvailabilityRepository.class);
        users = Mockito.mock(UserRepository.class);
        service = new AvailabilityService(slots, users);
    }

    @Test
    @SuppressWarnings("unchecked")
    void replaceDeletesThenSavesSortedUniqueSlots() {
        var request = new AvailabilityDtos.UpdateRequest(List.of(
                new AvailabilityDtos.Slot(5, "EVENING"), new AvailabilityDtos.Slot(1, "NIGHT"), new AvailabilityDtos.Slot(5, "EVENING"),
                new AvailabilityDtos.Slot(1, "MORNING")));

        AvailabilityDtos.Mine result = service.replace(userId, request);

        assertThat(result.slots()).containsExactly(new AvailabilityDtos.Slot(1, "MORNING"), new AvailabilityDtos.Slot(1, "NIGHT"), new AvailabilityDtos.Slot(5, "EVENING"));
        InOrder order = inOrder(slots);
        order.verify(slots).deleteByUserId(userId);
        ArgumentCaptor<List<UserAvailabilitySlot>> saved = ArgumentCaptor.forClass(List.class);
        order.verify(slots).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(3).allMatch(slot -> slot.getUserId().equals(userId));
    }

    @Test
    void replaceWithAnEmptyListClearsEverything() {
        assertThat(service.replace(userId, new AvailabilityDtos.UpdateRequest(List.of())).slots()).isEmpty();
        verify(slots).deleteByUserId(userId);
    }

    @Test
    void replaceRejectsInvalidSlotsWithoutWriting() {
        assertThatThrownBy(() -> service.replace(userId, new AvailabilityDtos.UpdateRequest(List.of(new AvailabilityDtos.Slot(0, "EVENING")))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.replace(userId, new AvailabilityDtos.UpdateRequest(List.of(new AvailabilityDtos.Slot(3, "LATE")))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.replace(userId, new AvailabilityDtos.UpdateRequest(Collections.nCopies(29, new AvailabilityDtos.Slot(1, "MORNING")))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.replace(userId, new AvailabilityDtos.UpdateRequest(List.of(new AvailabilityDtos.Slot(3, null)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.replace(userId, null)).isInstanceOf(BadRequestException.class);
        verify(slots, never()).deleteByUserId(any());
        verify(slots, never()).saveAll(any());
    }

    @Test
    void membersListsEveryActiveMemberEvenWithoutSlots() {
        User zoe = user("zoe");
        User alex = user("Alex");
        when(users.findAll()).thenReturn(List.of(zoe, alex));
        when(slots.findAll()).thenReturn(List.of(
                new UserAvailabilitySlot(zoe.getId(), (short) 6, UserAvailabilitySlot.Period.NIGHT),
                new UserAvailabilitySlot(zoe.getId(), (short) 2, UserAvailabilitySlot.Period.EVENING)));

        List<AvailabilityDtos.Member> members = service.members();

        assertThat(members).extracting(AvailabilityDtos.Member::username).containsExactly("Alex", "zoe");
        assertThat(members.get(0).slots()).isEmpty();
        assertThat(members.get(1).slots()).containsExactly(new AvailabilityDtos.Slot(2, "EVENING"), new AvailabilityDtos.Slot(6, "NIGHT"));
    }

    private static User user(String name) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(name);
        return user;
    }
}
