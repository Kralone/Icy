package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class PoleServiceTest {
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final PoleService service = new PoleService(users);

    @Test
    void listsTheThreePolesInOrderEvenWithoutSpecialist() {
        when(users.findSpecialistsWithPole()).thenReturn(List.of());

        assertThat(service.poles()).extracting(PoleDtos.Pole::key)
                .containsExactly("LOGISTIQUE", "MILITAIRE", "INDUSTRIE");
        assertThat(service.poles()).allSatisfy(pole -> assertThat(pole.specialists()).isEmpty());
    }

    @Test
    void groupsSpecialistsByPoleSortedByName() {
        User torin = specialist("torin", Specialty.INDUSTRIE, "/avatars/torin.webp");
        User aria = specialist("Aria", Specialty.INDUSTRIE, null);
        User nyx = specialist("Nyx", Specialty.MILITAIRE, null);
        when(users.findSpecialistsWithPole()).thenReturn(List.of(torin, nyx, aria));

        List<PoleDtos.Pole> poles = service.poles();

        assertThat(poles.get(0).specialists()).isEmpty();
        assertThat(poles.get(1).specialists()).extracting(PoleDtos.Specialist::username).containsExactly("Nyx");
        assertThat(poles.get(2).specialists()).extracting(PoleDtos.Specialist::username).containsExactly("Aria", "torin");
        assertThat(poles.get(2).specialists().get(1))
                .isEqualTo(new PoleDtos.Specialist(torin.getId(), "torin", "/avatars/torin.webp"));
    }

    private static User specialist(String username, Specialty specialty, String avatarUrl) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setSpecialty(specialty);
        user.setAvatarUrl(avatarUrl);
        return user;
    }
}
