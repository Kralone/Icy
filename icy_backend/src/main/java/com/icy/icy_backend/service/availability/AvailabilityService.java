package com.icy.icy_backend.service.availability;

import com.icy.icy_backend.controller.dto.availability.AvailabilityDtos;
import com.icy.icy_backend.db.entity.availability.UserAvailabilitySlot;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.availability.UserAvailabilityRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/** Disponibilités habituelles : chaque membre gère les siennes, les admins et officiers lisent la grille commune. */
@Service
@RequiredArgsConstructor
public class AvailabilityService {
    static final int MAX_SLOTS = 7 * UserAvailabilitySlot.Period.values().length;

    private final UserAvailabilityRepository slots;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public AvailabilityDtos.Mine mine(UUID userId) {
        return new AvailabilityDtos.Mine(slots.findByUserIdOrderByDayOfWeekAscPeriodAsc(userId).stream().map(AvailabilityService::toDto).toList());
    }

    @Transactional
    public AvailabilityDtos.Mine replace(UUID userId, AvailabilityDtos.UpdateRequest request) {
        if (request == null || request.slots() == null) throw new BadRequestException("Liste de créneaux manquante.");
        if (request.slots().size() > MAX_SLOTS) throw new BadRequestException("Trop de créneaux.");
        SortedSet<UserAvailabilitySlot.Key> unique = new TreeSet<>(Comparator.comparing(UserAvailabilitySlot.Key::getDayOfWeek).thenComparing(UserAvailabilitySlot.Key::getPeriod));
        for (AvailabilityDtos.Slot slot : request.slots()) {
            UserAvailabilitySlot.Period period = slot == null ? null : parsePeriod(slot.period());
            if (slot == null || slot.day() < 1 || slot.day() > 7 || period == null) {
                throw new BadRequestException("Créneau invalide : jour de 1 à 7 et créneau matin, après-midi, soir ou nuit.");
            }
            unique.add(new UserAvailabilitySlot.Key(userId, (short) slot.day(), period));
        }
        slots.deleteByUserId(userId);
        slots.saveAll(unique.stream()
                .map(key -> new UserAvailabilitySlot(userId, key.getDayOfWeek(), key.getPeriod()))
                .toList());
        return new AvailabilityDtos.Mine(unique.stream().map(key -> new AvailabilityDtos.Slot(key.getDayOfWeek(), key.getPeriod().name())).toList());
    }

    private static UserAvailabilitySlot.Period parsePeriod(String value) {
        if (value == null) return null;
        for (UserAvailabilitySlot.Period period : UserAvailabilitySlot.Period.values()) {
            if (period.name().equals(value)) return period;
        }
        return null;
    }

    /** Tous les membres actifs, renseignés ou non, triés par nom. */
    @Transactional(readOnly = true)
    public List<AvailabilityDtos.Member> members() {
        Map<UUID, List<AvailabilityDtos.Slot>> byUser = slots.findAll().stream()
                .sorted(Comparator.comparing(UserAvailabilitySlot::getDayOfWeek).thenComparing(UserAvailabilitySlot::getPeriod))
                .collect(Collectors.groupingBy(UserAvailabilitySlot::getUserId, Collectors.mapping(AvailabilityService::toDto, Collectors.toList())));
        return users.findAll().stream()
                .sorted(Comparator.comparing(user -> Optional.ofNullable(user.getUsername()).orElse("").toLowerCase(Locale.ROOT)))
                .map(user -> toMember(user, byUser.getOrDefault(user.getId(), List.of())))
                .toList();
    }

    private static AvailabilityDtos.Member toMember(User user, List<AvailabilityDtos.Slot> userSlots) {
        return new AvailabilityDtos.Member(user.getId(), user.getUsername(), user.getAvatarUrl(), userSlots);
    }

    private static AvailabilityDtos.Slot toDto(UserAvailabilitySlot slot) {
        return new AvailabilityDtos.Slot(slot.getDayOfWeek(), slot.getPeriod().name());
    }
}
