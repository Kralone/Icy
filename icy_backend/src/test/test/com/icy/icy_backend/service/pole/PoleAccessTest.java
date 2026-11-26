package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.security.UserAuthDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

class PoleAccessTest {
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final EventRepository events = Mockito.mock(EventRepository.class);
    private final PoleAccess access = new PoleAccess(users, events);

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void administratorsAndOfficersOrganizeEverythingAndChooseThePole() {
        UUID eventId = event(Specialty.INDUSTRIE);
        for (String role : List.of("ADMIN", "OFFICIER")) {
            signIn(role, null);
            assertThat(access.canCreate()).isTrue();
            assertThat(access.manages(eventId)).isTrue();
            assertThat(access.manages(UUID.randomUUID())).isTrue();
            assertThat(access.polesFor(List.of("LOGISTIQUE"))).containsExactly(Specialty.LOGISTIQUE);
            assertThat(access.polesFor(List.of("industrie", "LOGISTIQUE", "INDUSTRIE"))).containsExactly(Specialty.LOGISTIQUE, Specialty.INDUSTRIE);
            assertThat(access.polesFor(null)).isEmpty();
        }
    }

    @Test
    void aReferentOrganizesAnActivityThatConcernsTheirPoleAmongOthers() {
        signIn("SPECIALISTE", Specialty.MILITAIRE);
        assertThat(access.manages(event(Specialty.INDUSTRIE, Specialty.MILITAIRE))).isTrue();
        assertThat(access.manages(event(Specialty.INDUSTRIE, Specialty.LOGISTIQUE))).isFalse();
    }

    @Test
    void aReferentOrganizesTheActivitiesOfTheirPoleOnly() {
        signIn("SPECIALISTE", Specialty.MILITAIRE);
        assertThat(access.canCreate()).isTrue();
        assertThat(access.manages(event(Specialty.MILITAIRE))).isTrue();
        assertThat(access.manages(event(Specialty.INDUSTRIE))).isFalse();
        assertThat(access.manages(event())).isFalse();
        assertThat(access.manages(UUID.randomUUID())).isFalse();
        assertThat(access.managesPole(Specialty.MILITAIRE)).isTrue();
        assertThat(access.managesPole(Specialty.LOGISTIQUE)).isFalse();
    }

    @Test
    void aReferentAddsOtherPolesButAlwaysKeepsTheirOwn() {
        signIn("SPECIALISTE", Specialty.MILITAIRE);
        assertThat(access.polesFor(List.of("INDUSTRIE"))).containsExactly(Specialty.MILITAIRE, Specialty.INDUSTRIE);
        assertThat(access.polesFor(null)).containsExactly(Specialty.MILITAIRE);
        assertThat(access.polesFor(List.of())).containsExactly(Specialty.MILITAIRE);
    }

    @Test
    void otherMembersOrganizeNothing() {
        UUID eventId = event(Specialty.MILITAIRE);
        signIn("INGENIEUR", null);
        assertThat(access.canCreate()).isFalse();
        assertThat(access.manages(eventId)).isFalse();
        assertThatThrownBy(() -> access.polesFor(List.of("MILITAIRE"))).isInstanceOf(AccessDeniedException.class);
        // Un Spécialiste sans pôle n'est référent de rien.
        signIn("SPECIALISTE", null);
        assertThat(access.canCreate()).isFalse();
        assertThat(access.manages(eventId)).isFalse();
    }

    private UUID event(Specialty... poles) {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setPoles(List.of(poles));
        when(events.findById(event.getId())).thenReturn(Optional.of(event));
        return event.getId();
    }

    private void signIn(String role, Specialty specialty) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("membre");
        user.setSpecialty(specialty);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        UserAuthDetails details = Mockito.mock(UserAuthDetails.class);
        when(details.getId()).thenReturn(user.getId());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                details, null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
