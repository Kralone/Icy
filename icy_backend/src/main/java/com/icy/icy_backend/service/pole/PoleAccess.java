package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.security.AuthUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Qui organise quoi. Un Administrateur ou un Officier organise tous les événements et opérations ;
 * un Spécialiste référent organise ceux qui concernent son pôle, même s'ils concernent aussi d'autres pôles.
 * Les contrôles statiques servent aux services qui n'ont que l'identifiant de l'activité.
 */
@Component("poleAccess")
public class PoleAccess {
    private static volatile PoleAccess instance;

    private final UserRepository users;
    private final EventRepository events;

    public PoleAccess(UserRepository users, EventRepository events) {
        this.users = users;
        this.events = events;
    }

    @PostConstruct
    void register() {
        instance = this;
    }

    /** Administrateur ou Officier : organise tout. */
    public static boolean organizer() {
        return AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER");
    }

    /** Le membre connecté organise cette activité : organisateur, ou référent du pôle auquel elle est rattachée. */
    public static boolean organizes(UUID eventId) {
        if (organizer()) return true;
        PoleAccess access = instance;
        return access != null && access.manages(eventId);
    }

    /** Pôle dont le membre connecté est référent ; null s'il n'est référent d'aucun pôle. */
    public static Specialty currentPole() {
        PoleAccess access = instance;
        return access == null ? null : access.ownPole();
    }

    public Specialty ownPole() {
        if (!AuthUtils.hasRole(Specialty.RANK)) return null;
        UUID userId = AuthUtils.getCurrentUserId();
        return userId == null ? null : users.findById(userId).map(User::getSpecialty).orElse(null);
    }

    /** Peut créer un événement ou une opération : organisateur, ou référent d'un pôle. */
    public boolean canCreate() {
        return organizer() || ownPole() != null;
    }

    public boolean manages(UUID eventId) {
        if (organizer()) return true;
        Specialty own = ownPole();
        if (own == null || eventId == null) return false;
        return events.findById(eventId).map(event -> event.concerns(own)).orElse(false);
    }

    public boolean managesPole(Specialty pole) {
        return organizer() || (pole != null && ownPole() == pole);
    }

    /**
     * Pôles à enregistrer pour une activité créée ou modifiée par le membre connecté :
     * ceux demandés pour un organisateur ; pour un référent, ceux demandés plus le sien, toujours inclus,
     * pour qu'il garde la main sur l'activité.
     */
    public java.util.EnumSet<Specialty> polesFor(java.util.Collection<String> requested) {
        java.util.EnumSet<Specialty> poles = Specialty.optionalAll(requested);
        if (organizer()) return poles;
        Specialty own = ownPole();
        if (own == null) throw new AccessDeniedException("Réservé aux organisateurs et aux référents de pôle");
        poles.add(own);
        return poles;
    }
}
