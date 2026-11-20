package com.icy.icy_backend.service.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.db.entity.pole.PoleNews;
import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.pole.PoleNewsRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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
    private static final String MINING = "MINING";

    private final PoleService poles;
    private final PoleNewsRepository news;
    private final SessionSheetRepository sheets;
    private final UserRepository users;
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
                industry ? industryStats() : List.of(),
                industry ? industryActivity() : List.of(),
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
        LocalDate since = LocalDate.now(clock).minusDays(STATS_DAYS);
        return List.of(
                new PoleDtos.Stat("MINING_SHEETS_30D", sheets.countByActivityAndSessionDateGreaterThanEqual(MINING, since)),
                new PoleDtos.Stat("MINING_SHEETS_OPEN", sheets.countByActivityAndStatusNot(MINING, SessionSheet.Status.CLOSED)),
                new PoleDtos.Stat("MINERS_30D", sheets.countParticipantsSince(MINING, since)),
                new PoleDtos.Stat("MINING_SALES_30D", sheets.sumSalesSince(MINING, since)));
    }

    private List<PoleDtos.Activity> industryActivity() {
        return sheets.findTop4ByActivityOrderBySessionDateDescCreatedAtDesc(MINING).stream()
                .map(sheet -> new PoleDtos.Activity("MINING_SHEET", sheet.getId(), sheet.getName(), sheet.getSessionDate(), sheet.getStatus().name()))
                .toList();
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
