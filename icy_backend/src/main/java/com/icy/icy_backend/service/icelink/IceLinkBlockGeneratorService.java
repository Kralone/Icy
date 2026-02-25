package com.icy.icy_backend.service.icelink;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.icelink.IceLinkBlock;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.service.event.EventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IceLinkBlockGeneratorService {

    private final EventService eventService;
    private final UserRepository userRepository;
    private final UserShipRepository userShipRepository;

    /**
     * Génère dynamiquement le contenu d’un bloc selon son nom.
     */
    public String generateDynamicContent(IceLinkBlock block) {
        if (block.getName() == null) return block.getContent();

        switch (block.getName().trim().toLowerCase()) {
            case "activité":
            case "activités":
            case "events":
            case "activités futures":
            case "événements à venir":
            case "evenements a venir":
                return generateActivityContent();
            case "nouveaux membres":
            case "nouveaux":
            case "new members":
            case "newcomers":
                return generateNewMembersContent();
            case "nouveaux vaisseaux":
            case "new ships":
            case "nouveaux ships":
                return generateNewShipsContent();
            default:
                return block.getContent();
        }
    }

    private String generateActivityContent() {
        LocalDate now = LocalDate.now();
        LocalDate twoWeeksLater = now.plusWeeks(2);

        List<Event> events = eventService.getEventsBetween(now, twoWeeksLater);

        if (events.isEmpty()) {
            log.info("Aucun événement trouvé pour les deux prochaines semaines.");
            return """
               ## 📅 Activités à venir
               > _Aucune activité prévue pour les deux prochaines semaines._
               """;
        }

        String formattedEvents = events.stream()
                .map(event -> String.format("""
                    > **%s**
                    > 📆 %s%s
                    > %s
                    """,
                        event.getTitle(),
                        event.getStartDateTime().toLocalDate(),
                        (event.getType() != null && event.getType().getName() != null)
                                ? " · " + event.getType().getName()
                                : "",
                        event.getDescription() != null && !event.getDescription().isBlank()
                                ? event.getDescription()
                                : "_Pas de description disponible._"
                ))
                .collect(Collectors.joining("\n"));

        return """
           ## 📅 Activités à venir

           """ + formattedEvents;
    }

    private String generateNewMembersContent() {
        LocalDateTime since = LocalDateTime.now().minusDays(3);
        List<User> users = userRepository.findByCreatedAtAfterOrderByCreatedAtDesc(since);

        if (users.isEmpty()) {
            log.info("Aucun nouveau membre trouvé sur les 3 derniers jours.");
            return """
               ## 🆕 Nouveaux membres
               > _Aucun nouveau membre récemment._
               """;
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");
        String formattedUsers = users.stream()
                .limit(10)
                .map(user -> String.format("> **%s** · arrivé le %s",
                        user.getUsername(),
                        user.getCreatedAt() != null ? user.getCreatedAt().format(formatter) : "?"
                ))
                .collect(Collectors.joining("\n"));

        return """
           ## 🆕 Nouveaux membres

           """ + formattedUsers;
    }

    private String generateNewShipsContent() {
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        List<UserShip> userShips = userShipRepository.findRecentWithShipAndUser(since);

        if (userShips.isEmpty()) {
            log.info("Aucun nouveau vaisseau trouvé sur les 7 derniers jours.");
            return """
               ## 🚀 Nouveaux vaisseaux
               > _Aucun nouveau vaisseau récemment._
               """;
        }

        String formattedShips = userShips.stream()
                .limit(10)
                .map(userShip -> String.format("> **%s** · %s",
                        userShip.getShip().getName(),
                        userShip.getUser().getUsername()
                ))
                .collect(Collectors.joining("\n"));

        return """
           ## 🚀 Nouveaux vaisseaux

           """ + formattedShips;
    }

}






