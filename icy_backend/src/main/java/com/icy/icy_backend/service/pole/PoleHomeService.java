package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.db.entity.pole.PoleNews;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.pole.PoleNewsRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;

/**
 * Accueil d'un pôle : référents, chiffres, activité récente et actualités.
 * Un pôle est géré par ses Spécialistes référents, les Officiers et les Administrateurs.
 */
@Service
@RequiredArgsConstructor
public class PoleHomeService {
    static final int STATS_DAYS = 30;
    static final int TITLE_MAX = 120;
    static final int CONTENT_MAX = 4000;
    static final int AGENDA_MAX = 6;
    static final int ACTIVITY_MAX = 4;
    private static final String MINING = "MINING";

    private final PoleService poles;
    private final PoleNewsRepository news;
    private final SessionSheetRepository sheets;
    private final UserRepository users;
    private final EventRepository events;
    private final OperationRepository operations;
    private Clock clock = Clock.systemDefaultZone();

    void setClock(Clock clock) {
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PoleDtos.Home home(String key) {
        Specialty pole = pole(key);
        List<PoleDtos.Specialist> specialists = poles.poles().stream()
                .filter(entry -> entry.key().equals(pole.name()))
                .flatMap(entry -> entry.specialists().stream())
                .toList();
        boolean industry = pole == Specialty.INDUSTRIE;
        return new PoleDtos.Home(pole.name(), specialists, canManage(pole),
                industry ? industryStats() : eventStats(pole),
                industry ? industryActivity() : eventActivity(pole),
                agenda(pole),
                news.findTop10ByPoleOrderByCreatedAtDescIdDesc(pole).stream().map(PoleHomeService::view).toList());
    }

    @Transactional
    public PoleDtos.News publish(String key, PoleDtos.NewsRequest request) {
        Specialty pole = pole(key);
        requireManage(pole);
        User author = users.findById(AuthUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));
        PoleNews entry = new PoleNews();
        entry.setPole(pole);
        fill(entry, request);
        entry.setAuthorUserId(author.getId());
        entry.setAuthorName(author.getUsername());
        entry.setCreatedAt(LocalDateTime.now(clock));
        return view(news.save(entry));
    }

    @Transactional
    public PoleDtos.News update(String key, Long id, PoleDtos.NewsRequest request) {
        PoleNews entry = entry(key, id);
        fill(entry, request);
        entry.setUpdatedAt(LocalDateTime.now(clock));
        return view(news.save(entry));
    }

    @Transactional
    public void delete(String key, Long id) {
        news.delete(entry(key, id));
    }

    /** L'actualité du pôle demandé, après contrôle du droit de gestion. */
    private PoleNews entry(String key, Long id) {
        Specialty pole = pole(key);
        requireManage(pole);
        return news.findById(id).filter(found -> found.getPole() == pole)
                .orElseThrow(() -> new ResourceNotFoundException("Actualité introuvable"));
    }

    private static void fill(PoleNews entry, PoleDtos.NewsRequest request) {
        String title = request == null || request.title() == null ? "" : request.title().trim();
        String content = request == null || request.content() == null ? "" : request.content().trim();
        if (title.isEmpty() || content.isEmpty()) throw new BadRequestException("Le titre et le texte sont obligatoires.");
        if (title.length() > TITLE_MAX) throw new BadRequestException("Le titre dépasse " + TITLE_MAX + " caractères.");
        if (content.length() > CONTENT_MAX) throw new BadRequestException("Le texte dépasse " + CONTENT_MAX + " caractères.");
        entry.setTitle(title);
        entry.setContent(content);
    }

    boolean canManage(Specialty pole) {
        if (AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER")) return true;
        if (!AuthUtils.hasRole("SPECIALISTE")) return false;
        UUID userId = AuthUtils.getCurrentUserId();
        return userId != null && users.findById(userId).map(user -> user.getSpecialty() == pole).orElse(false);
    }

    private void requireManage(Specialty pole) {
        if (!canManage(pole)) throw new ForbiddenException("Seuls les référents du pôle, les Officiers et les Administrateurs gèrent ce pôle.");
    }

    private List<PoleDtos.Stat> industryStats() {
        LocalDate today = LocalDate.now(clock);
        LocalDate since = today.minusDays(STATS_DAYS);
        return List.of(
                new PoleDtos.Stat("MINING_SHEETS_30D", sheets.countByActivityAndSessionDateBetween(MINING, since, today)),
                new PoleDtos.Stat("MINING_SHEETS_OPEN", sheets.countByActivityAndStatusNot(MINING, SessionSheet.Status.CLOSED)),
                new PoleDtos.Stat("MINERS_30D", sheets.countParticipantsBetween(MINING, since, today)),
                new PoleDtos.Stat("MINING_SALES_30D", sheets.sumSalesSince(MINING, since.atStartOfDay())));
    }

    private List<PoleDtos.Activity> industryActivity() {
        return sheets.findTop4ByActivityOrderBySessionDateDescCreatedAtDesc(MINING).stream()
                .map(sheet -> new PoleDtos.Activity("MINING_SHEET", sheet.getId(), sheet.getName(), sheet.getSessionDate(), sheet.getStatus().name()))
                .toList();
    }

    /** Chiffres d'un pôle sans outil propre : ses événements et opérations rattachés. */
    private List<PoleDtos.Stat> eventStats(Specialty pole) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime since = now.minusDays(STATS_DAYS);
        return List.of(
                new PoleDtos.Stat("POLE_ACTIVITIES_30D", events.countEndedOfPoleBetween(pole, since, now)),
                new PoleDtos.Stat("POLE_PARTICIPANTS_30D", events.countParticipantsOfPoleBetween(pole, since, now)),
                new PoleDtos.Stat("POLE_UPCOMING", events.countUpcomingOfPole(pole, now)));
    }

    /** Dernières activités terminées du pôle. */
    private List<PoleDtos.Activity> eventActivity(Specialty pole) {
        return events.findPastOfPole(pole, LocalDateTime.now(clock), PageRequest.of(0, ACTIVITY_MAX)).stream()
                .map(event -> new PoleDtos.Activity(event.getActivityType().name(), event.getId(), event.getTitle(),
                        event.getStartDateTime().toLocalDate(), null))
                .toList();
    }

    /** Prochains événements et opérations du pôle ; une opération montre son image, sinon celle de son type. */
    private List<PoleDtos.Agenda> agenda(Specialty pole) {
        List<Event> upcoming = events.findUpcomingOfPole(pole, LocalDateTime.now(clock), PageRequest.of(0, AGENDA_MAX));
        Map<UUID, String> operationImages = new HashMap<>();
        operations.findAllById(upcoming.stream().map(Event::getId).toList())
                .forEach(operation -> operationImages.put(operation.getEventId(), operation.getImageUrl()));
        return upcoming.stream().map(event -> {
            String image = operationImages.get(event.getId());
            if ((image == null || image.isBlank()) && event.getType() != null) image = event.getType().getImageUrl();
            return new PoleDtos.Agenda(event.getId(), event.getActivityType().name(), event.getTitle(),
                    event.getType() == null ? null : event.getType().getName(),
                    image == null || image.isBlank() ? null : image, event.getStartDateTime(), event.getEndDateTime());
        }).toList();
    }

    private static Specialty pole(String key) {
        try {
            return Specialty.valueOf(key == null ? "" : key.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new ResourceNotFoundException("Pôle introuvable");
        }
    }

    private static PoleDtos.News view(PoleNews entry) {
        return new PoleDtos.News(entry.getId(), entry.getTitle(), entry.getContent(), entry.getAuthorName(),
                entry.getCreatedAt(), entry.getUpdatedAt());
    }
}
