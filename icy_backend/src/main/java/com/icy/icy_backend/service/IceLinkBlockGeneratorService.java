package com.icy.icy_backend.service;

import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.entity.IceLinkBlock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IceLinkBlockGeneratorService {

    private final EventService eventService;

    /**
     * Génère dynamiquement le contenu d’un bloc selon son nom.
     */
    public String generateDynamicContent(IceLinkBlock block) {
        if (block.getName() == null) return block.getContent();

        switch (block.getName().trim().toLowerCase()) {
            case "activité":
            case "activités":
            case "events":
                return generateActivityContent();
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

}
