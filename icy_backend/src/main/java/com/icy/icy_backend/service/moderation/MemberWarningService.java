package com.icy.icy_backend.service.moderation;

import com.icy.icy_backend.controller.dto.moderation.ModerationDtos;
import com.icy.icy_backend.db.entity.moderation.DeliveryStatus;
import com.icy.icy_backend.db.entity.moderation.MemberSanction;
import com.icy.icy_backend.db.entity.moderation.MemberWarning;
import com.icy.icy_backend.db.entity.moderation.SanctionDecision;
import com.icy.icy_backend.db.entity.moderation.WarningCategory;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.moderation.MemberSanctionRepository;
import com.icy.icy_backend.db.repository.moderation.MemberWarningRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.UserManagementPolicy;
import com.icy.icy_backend.service.notification.NotificationPushService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Avertissements disciplinaires. Un Officier ou un Directeur avertit un membre ; le bot lui envoie le motif et
 * son rang (1er, 2e, 3e…). Au seuil, un Directeur décide : exclusion (compte du site désactivé, ban Discord
 * fait à la main puis confirmé ici) ou dernière chance. Un Officier ne peut pas avertir un Officier ou un Directeur.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberWarningService {
    static final int REASON_MAX = 1000;
    static final int NOTE_MAX = 1000;
    static final int REVOKE_REASON_MAX = 500;
    static final int MIN_THRESHOLD = 2;

    private final MemberWarningRepository warnings;
    private final MemberSanctionRepository sanctions;
    private final UserRepository users;
    private final ModerationMessenger messenger;
    private final NotificationPushService notifications;

    @Value("${iceforge.moderation.warning-threshold:3}")
    private int threshold = 3;
    private Clock clock = Clock.systemDefaultZone();

    void setClock(Clock clock) {
        this.clock = clock;
    }

    void setThreshold(int threshold) {
        this.threshold = threshold;
    }

    int threshold() {
        return Math.max(MIN_THRESHOLD, threshold);
    }

    // ==== Lecture ====

    @Transactional(readOnly = true)
    public ModerationDtos.Summary summary() {
        Map<UUID, List<MemberWarning>> active = warnings.findByRevokedAtIsNull().stream()
                .collect(Collectors.groupingBy(MemberWarning::getUserId));
        Map<UUID, List<MemberSanction>> decisions = active.isEmpty() ? Map.of()
                : sanctions.findByUserIdIn(active.keySet()).stream().collect(Collectors.groupingBy(MemberSanction::getUserId));
        List<ModerationDtos.Standing> standings = active.entrySet().stream()
                .map(entry -> {
                    LocalDateTime last = entry.getValue().stream().map(MemberWarning::getCreatedAt).max(Comparator.naturalOrder()).orElse(null);
                    return new ModerationDtos.Standing(entry.getKey(), entry.getValue().size(), last,
                            pendingDecision(entry.getValue().size(), last, decisions.getOrDefault(entry.getKey(), List.of())));
                })
                .sorted(Comparator.comparing(ModerationDtos.Standing::userId))
                .toList();

        List<MemberSanction> bans = sanctions.findByDecisionAndDiscordBanDoneAtIsNullOrderByCreatedAtAsc(SanctionDecision.EXCLUDE);
        Map<UUID, User> excluded = bans.isEmpty() ? Map.of()
                : users.findAllByIdIncludingInactive(bans.stream().map(MemberSanction::getUserId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        List<ModerationDtos.BanTask> tasks = bans.stream()
                .filter(ban -> excluded.containsKey(ban.getUserId()))
                .map(ban -> {
                    User user = excluded.get(ban.getUserId());
                    return new ModerationDtos.BanTask(ban.getId(), user.getId(), user.getUsername(), user.getDiscordId(),
                            ban.getDecidedByName(), ban.getCreatedAt());
                })
                .toList();
        return new ModerationDtos.Summary(threshold(), standings, tasks);
    }

    @Transactional(readOnly = true)
    public ModerationDtos.Record record(UUID userId) {
        return record(anyUser(userId));
    }

    // ==== Avertir, lever ====

    @Transactional
    public ModerationDtos.Record warn(UUID userId, ModerationDtos.WarningRequest request) {
        User target = activeUser(userId);
        requireCanWarn(target);
        WarningCategory category = category(request == null ? null : request.category());
        String reason = text(request == null ? null : request.reason(), REASON_MAX, "Le motif");
        if (reason == null) throw new BadRequestException("Le motif est obligatoire : il est envoyé au membre.");
        User author = currentUser();

        MemberWarning warning = new MemberWarning();
        warning.setUserId(target.getId());
        warning.setCategory(category);
        warning.setReason(reason);
        warnings.lockMember(target.getId());
        long activeBefore = warnings.countByUserIdAndRevokedAtIsNull(target.getId());
        // Une décision déjà attendue a été annoncée aux Directeurs : un avertissement de plus ne la réannonce pas.
        boolean alreadyPending = pendingDecision(target.getId(), activeBefore);
        warning.setRank((int) activeBefore + 1);
        warning.setIssuedByUserId(author.getId());
        warning.setIssuedByName(author.getUsername());
        warning.setCreatedAt(LocalDateTime.now(clock));
        warning.setDmStatus(DeliveryStatus.PENDING);
        warning.setDmDeliveryId(messenger.send(target, WarningMessages.warning(warning, threshold())));
        warning = warnings.save(warning);
        log.info("Avertissement n°{} donné à {} par {}", warning.getRank(), target.getId(), author.getId());

        if (warning.getRank() >= threshold() && !alreadyPending) {
            notifyDirectors(target, warning.getRank());
        }
        return record(target);
    }

    @Transactional
    public ModerationDtos.Record revoke(Long warningId, ModerationDtos.RevokeRequest request) {
        MemberWarning warning = warnings.findById(warningId)
                .orElseThrow(() -> new ResourceNotFoundException("Avertissement introuvable"));
        User target = anyUser(warning.getUserId());
        requireCanWarn(target);
        if (!warning.isActive()) throw new BadRequestException("Cet avertissement est déjà levé.");
        String reason = text(request == null ? null : request.reason(), REVOKE_REASON_MAX, "La raison");
        User author = currentUser();
        warning.setRevokedAt(LocalDateTime.now(clock));
        warning.setRevokedByName(author.getUsername());
        warning.setRevokeReason(reason);
        warnings.save(warning);

        boolean notify = request == null || request.notifyMember() == null || request.notifyMember();
        if (notify && Boolean.TRUE.equals(target.getActive())) {
            long remaining = warnings.countByUserIdAndRevokedAtIsNull(target.getId());
            messenger.send(target, WarningMessages.revoked(warning, reason, remaining));
        }
        return record(target);
    }

    /** Renvoie le message d'un avertissement que Discord a refusé, par exemple après que le membre a ouvert ses messages privés. */
    @Transactional
    public ModerationDtos.Record resend(Long warningId) {
        MemberWarning warning = warnings.findById(warningId)
                .orElseThrow(() -> new ResourceNotFoundException("Avertissement introuvable"));
        User target = activeUser(warning.getUserId());
        requireCanWarn(target);
        if (!warning.isActive()) throw new BadRequestException("Cet avertissement est levé : il n'y a rien à renvoyer.");
        if (warning.getDmStatus() != DeliveryStatus.FAILED) throw new BadRequestException("Le message n'a pas échoué : il n'y a rien à renvoyer.");
        warning.setDmStatus(DeliveryStatus.PENDING);
        warning.setDmFailure(null);
        warning.setDmDeliveryId(messenger.send(target, WarningMessages.warning(warning, threshold())));
        warnings.save(warning);
        return record(target);
    }

    // ==== Décision au seuil (Directeur) ====

    @Transactional
    public ModerationDtos.Record decide(UUID userId, ModerationDtos.DecisionRequest request) {
        requireDirector();
        // Deux Directeurs qui décident en même temps : le second attend, puis ne voit plus de décision en attente.
        if (userId != null) warnings.lockMember(userId);
        User target = activeUser(userId);
        if (target.getId().equals(AuthUtils.getCurrentUserId())) throw new ForbiddenException("Tu ne peux pas décider de ta propre exclusion.");
        SanctionDecision decision = decision(request == null ? null : request.decision());
        long active = warnings.countByUserIdAndRevokedAtIsNull(target.getId());
        if (!pendingDecision(target.getId(), active)) {
            throw new BadRequestException("Ce membre n'a pas de décision en attente : il faut " + threshold() + " avertissements en cours.");
        }
        String note = text(request == null ? null : request.note(), NOTE_MAX, "La note");
        User author = currentUser();

        MemberSanction sanction = new MemberSanction();
        sanction.setUserId(target.getId());
        sanction.setDecision(decision);
        sanction.setNote(note);
        sanction.setDecidedByUserId(author.getId());
        sanction.setDecidedByName(author.getUsername());
        sanction.setCreatedAt(LocalDateTime.now(clock));
        boolean notify = request == null || request.notifyMember() == null || request.notifyMember();
        if (notify) {
            ModerationMessage message = decision == SanctionDecision.EXCLUDE
                    ? WarningMessages.excluded(active, note) : WarningMessages.kept(active, note);
            sanction.setDmStatus(DeliveryStatus.PENDING);
            sanction.setDmDeliveryId(messenger.send(target, message));
        }
        sanctions.save(sanction);

        if (decision == SanctionDecision.EXCLUDE) {
            // Même effet que « Désactiver » sur la page Membres : le compte ne peut plus se connecter.
            target.setActive(false);
            users.save(target);
            log.info("Membre {} exclu par {} après {} avertissements", target.getId(), author.getId(), active);
        }
        return record(target);
    }

    /** Le ban Discord d'une exclusion se fait à la main ; un Directeur confirme ici qu'il est fait. */
    @Transactional
    public ModerationDtos.Record confirmDiscordBan(Long sanctionId) {
        requireDirector();
        MemberSanction sanction = sanctions.findById(sanctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Décision introuvable"));
        if (sanction.getDecision() != SanctionDecision.EXCLUDE) throw new BadRequestException("Seule une exclusion demande un ban Discord.");
        if (sanction.getDiscordBanDoneAt() == null) {
            sanction.setDiscordBanDoneAt(LocalDateTime.now(clock));
            sanction.setDiscordBanDoneBy(currentUser().getUsername());
            sanctions.save(sanction);
        }
        return record(anyUser(sanction.getUserId()));
    }

    // ==== Retour du bot ====

    /** Rattache le résultat d'un message privé à son avertissement ou à sa décision. Un identifiant inconnu est ignoré. */
    @Transactional
    public boolean recordDelivery(UUID deliveryId, boolean sent, String failure) {
        if (deliveryId == null) return false;
        DeliveryStatus status = sent ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
        String reason = sent ? null : shortFailure(failure);
        Optional<MemberWarning> warning = warnings.findByDmDeliveryId(deliveryId);
        if (warning.isPresent()) {
            warning.get().setDmStatus(status);
            warning.get().setDmFailure(reason);
            warnings.save(warning.get());
            return true;
        }
        Optional<MemberSanction> sanction = sanctions.findByDmDeliveryId(deliveryId);
        if (sanction.isPresent()) {
            sanction.get().setDmStatus(status);
            sanction.get().setDmFailure(reason);
            sanctions.save(sanction.get());
            return true;
        }
        return false;
    }

    // ==== Règles ====

    /**
     * Une décision est attendue quand le seuil est atteint et qu'aucune décision n'a été prise depuis le dernier
     * avertissement en cours : après une dernière chance, l'avertissement suivant rouvre la décision.
     */
    static boolean pendingDecision(long activeWarnings, LocalDateTime lastWarningAt, List<MemberSanction> decisions, int threshold) {
        if (activeWarnings < threshold || lastWarningAt == null) return false;
        return decisions.stream().noneMatch(decision -> !decision.getCreatedAt().isBefore(lastWarningAt));
    }

    private boolean pendingDecision(long activeWarnings, LocalDateTime lastWarningAt, List<MemberSanction> decisions) {
        return pendingDecision(activeWarnings, lastWarningAt, decisions, threshold());
    }

    private boolean pendingDecision(UUID userId, long activeWarnings) {
        LocalDateTime last = warnings.findByUserIdOrderByCreatedAtDescIdDesc(userId).stream()
                .filter(MemberWarning::isActive).map(MemberWarning::getCreatedAt).findFirst().orElse(null);
        return pendingDecision(activeWarnings, last, sanctions.findByUserIdOrderByCreatedAtDescIdDesc(userId));
    }

    private ModerationDtos.Record record(User target) {
        List<MemberWarning> history = warnings.findByUserIdOrderByCreatedAtDescIdDesc(target.getId());
        List<MemberSanction> decisions = sanctions.findByUserIdOrderByCreatedAtDescIdDesc(target.getId());
        long active = history.stream().filter(MemberWarning::isActive).count();
        LocalDateTime last = history.stream().filter(MemberWarning::isActive).map(MemberWarning::getCreatedAt).findFirst().orElse(null);
        boolean isActive = Boolean.TRUE.equals(target.getActive());
        return new ModerationDtos.Record(target.getId(), target.getUsername(), target.getDiscordId(), isActive, threshold(),
                active, isActive && pendingDecision(active, last, decisions),
                isActive && canWarn(target), AuthUtils.isAdmin(),
                history.stream().map(MemberWarningService::view).toList(),
                decisions.stream().map(MemberWarningService::view).toList());
    }

    private boolean canWarn(User target) {
        if (target.getId().equals(AuthUtils.getCurrentUserId())) return false;
        try {
            UserManagementPolicy.assertCanManage(target, null);
            return true;
        } catch (ForbiddenException e) {
            return false;
        }
    }

    private void requireCanWarn(User target) {
        if (target.getId().equals(AuthUtils.getCurrentUserId())) throw new ForbiddenException("Tu ne peux pas t'avertir toi-même.");
        if (!canWarn(target)) throw new ForbiddenException("Un Officier ne peut pas avertir un Officier ou un Directeur.");
    }

    private static void requireDirector() {
        if (!AuthUtils.isAdmin()) throw new ForbiddenException("Seul un Directeur décide d'une exclusion.");
    }

    private User activeUser(UUID userId) {
        if (userId == null) throw new BadRequestException("Membre manquant.");
        return users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable ou désactivé"));
    }

    private User anyUser(UUID userId) {
        if (userId == null) throw new BadRequestException("Membre manquant.");
        return users.findByIdIncludingInactive(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable"));
    }

    private User currentUser() {
        return users.findById(AuthUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));
    }

    private void notifyDirectors(User target, int rank) {
        List<UUID> directors = users.findAllByRoleName("ADMIN").stream().map(User::getId).toList();
        if (directors.isEmpty()) return;
        notifications.sendToUsers(directors, "Exclusion à décider",
                target.getUsername() + " a reçu son " + WarningMessages.ordinal(rank) + " avertissement.",
                "/icy/admin/members?discipline=" + target.getId(), 3);
    }

    private static WarningCategory category(String value) {
        if (value == null || value.isBlank()) throw new BadRequestException("Choisis la nature de l'avertissement.");
        try {
            return WarningCategory.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Nature d'avertissement inconnue.");
        }
    }

    private static SanctionDecision decision(String value) {
        if (value == null || value.isBlank()) throw new BadRequestException("Choisis une décision.");
        try {
            return SanctionDecision.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Décision inconnue.");
        }
    }

    /** Texte saisi, nettoyé ; null s'il est vide. */
    private static String text(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.strip();
        if (trimmed.length() > max) throw new BadRequestException(label + " dépasse " + max + " caractères.");
        return trimmed;
    }

    private static String shortFailure(String failure) {
        if (failure == null || failure.isBlank()) return "unknown";
        String trimmed = failure.trim();
        return trimmed.length() > 32 ? trimmed.substring(0, 32) : trimmed;
    }

    private static ModerationDtos.Warning view(MemberWarning warning) {
        return new ModerationDtos.Warning(warning.getId(), warning.getCategory().name(), warning.getReason(), warning.getRank(),
                warning.getIssuedByName(), warning.getCreatedAt(), warning.isActive(), warning.getRevokedAt(),
                warning.getRevokedByName(), warning.getRevokeReason(), warning.getDmStatus().name(), warning.getDmFailure());
    }

    private static ModerationDtos.Sanction view(MemberSanction sanction) {
        return new ModerationDtos.Sanction(sanction.getId(), sanction.getDecision().name(), sanction.getNote(),
                sanction.getDecidedByName(), sanction.getCreatedAt(), sanction.getDiscordBanDoneAt(), sanction.getDiscordBanDoneBy(),
                sanction.getDmStatus() == null ? null : sanction.getDmStatus().name(), sanction.getDmFailure());
    }
}
