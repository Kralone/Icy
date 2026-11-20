package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Les pôles ne sont pas des groupes de membres : un pôle n'a que ses Spécialistes référents,
 * lus sur le sous-grade des membres.
 */
@Service
@RequiredArgsConstructor
public class PoleService {
    private final UserRepository users;

    /** Les trois pôles, toujours présents et dans le même ordre, même sans référent. */
    @Transactional(readOnly = true)
    public List<PoleDtos.Pole> poles() {
        List<User> specialists = users.findSpecialistsWithPole();
        return Arrays.stream(Specialty.values())
                .map(pole -> new PoleDtos.Pole(pole.name(), specialists.stream()
                        .filter(user -> user.getSpecialty() == pole)
                        .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                        .map(user -> new PoleDtos.Specialist(user.getId(), user.getUsername(), user.getAvatarUrl()))
                        .toList()))
                .toList();
    }
}
