package com.icy.icy_backend.service.member;

import com.icy.icy_backend.service.operation.OperationLock;
import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.member.MemberFollowUp;
import com.icy.icy_backend.db.entity.member.MemberReminder;
import com.icy.icy_backend.db.entity.member.ReminderCampaign;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.DirectMessageRepository;
import com.icy.icy_backend.db.repository.member.MemberReminderRepository;
import com.icy.icy_backend.db.repository.member.ReminderCampaignRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.DirectMessageResultEvent;
import com.icy.icy_backend.messaging.DirectMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Campagnes de rappel et fiches de suivi.
 * <p>
 * Une campagne réunit les membres à prévenir. Envoyée par le bot, chaque fiche est notée « rappelé » quand Discord
 * confirme le message ; envoyée à la main, l'officier copie le texte personnalisé et coche lui-même.
 * Les réponses et décisions se notent ensuite fiche par fiche.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderCampaignService {
    public static final String ORIGIN = "REMINDER";
    static final int MAX_MEMBERS = 200;

    private final ReminderCampaignRepository campaigns;
    private final MemberReminderRepository reminders;
    private final DirectMessageRepository directMessages;
    private final UserRepository users;
    private final DirectMessageService directMessageService;
    private final MemberActivityService activity;
    private final MessageTemplateService templates;

    @Transactional(readOnly = true)
    public List<MemberActivityDtos.Campaign> list() {
        List<ReminderCampaign> all = campaigns.findAllByOrderByCreatedAtDesc();
        Map<Long, List<MemberReminder>> byCampaign = all.isEmpty() ? Map.of() : reminders.findByCampaignIdIn(all.stream().map(ReminderCampaign::getId).toList())
                .stream().collect(Collectors.groupingBy(MemberReminder::getCampaignId));
        Map<UUID, DirectMessage> deliveries = deliveries(byCampaign.values().stream().flatMap(List::stream).toList());
        Map<UUID, MemberActivityService.Pulse> pulses = activity.pulse(byCampaign.values().stream().flatMap(List::stream)
                .map(MemberReminder::getUserId).collect(Collectors.toSet()));
        return all.stream().map(campaign -> toCampaign(campaign, byCampaign.getOrDefault(campaign.getId(), List.of()), deliveries, null, pulses)).toList();
    }

    @Transactional(readOnly = true)
    public MemberActivityDtos.Campaign get(Long id) {
        ReminderCampaign campaign = find(id);
        List<MemberReminder> fiches = reminders.findByCampaignIdOrderByIdAsc(id);
        Map<UUID, User> members = users.findAllByIdIncludingInactive(ids(fiches)).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return toCampaign(campaign, fiches, deliveries(fiches), members, activity.pulse(ids(fiches)));
    }

    @Transactional
    public MemberActivityDtos.Campaign create(MemberActivityDtos.CampaignCreate request, UUID authorId, String authorName) {
        if (request == null) throw new BadRequestException("Campagne vide.");
        ReminderCampaign.Delivery delivery = parseDelivery(request.delivery());
        List<UUID> userIds = request.userIds() == null ? List.of() : request.userIds().stream().filter(Objects::nonNull).distinct().toList();
        if (userIds.isEmpty()) throw new BadRequestException("Choisissez au moins un membre à prévenir.");
        if (userIds.size() > MAX_MEMBERS) throw new BadRequestException("Au plus " + MAX_MEMBERS + " membres par campagne.");
        List<User> members = users.findAllById(userIds);
        if (members.size() != userIds.size()) throw new BadRequestException("Un des membres choisis n'existe plus ou a été désactivé.");

        boolean sendNow = Boolean.TRUE.equals(request.sendNow());
        LocalDateTime scheduledAt = delivery == ReminderCampaign.Delivery.BOT && !sendNow ? request.scheduledAt() : null;
        if (scheduledAt != null && scheduledAt.isBefore(LocalDateTime.now(OperationLock.ZONE).minusMinutes(1))) {
            throw new BadRequestException("L'heure d'envoi programmée est déjà passée.");
        }
        ReminderCampaign campaign = campaigns.save(ReminderCampaign.builder()
                .title(validTitle(request.title()))
                .body(MessageTemplateService.validBody(request.body()))
                .mediaFile(MessageTemplateService.validMedia(request.mediaFile()))
                .delivery(delivery)
                .status(delivery == ReminderCampaign.Delivery.MANUEL ? ReminderCampaign.Status.EN_COURS
                        : scheduledAt != null ? ReminderCampaign.Status.PROGRAMMEE : ReminderCampaign.Status.BROUILLON)
                .scheduledAt(scheduledAt)
                .createdBy(authorId)
                .createdByName(authorName)
                .createdAt(LocalDateTime.now(OperationLock.ZONE))
                .build());

        Map<UUID, Integer> days = activity.daysInactive(userIds);
        List<MemberReminder> fiches = reminders.saveAll(members.stream()
                .sorted(Comparator.comparing(user -> Optional.ofNullable(user.getUsername()).orElse("").toLowerCase(Locale.ROOT)))
                .map(user -> MemberReminder.builder().campaignId(campaign.getId()).userId(user.getId()).daysInactive(days.get(user.getId())).build())
                .toList());
        if (sendNow && delivery == ReminderCampaign.Delivery.BOT) {
            dispatch(campaign, fiches, members, authorId);
        }
        return get(campaign.getId());
    }

    @Transactional
    public MemberActivityDtos.Campaign update(Long id, MemberActivityDtos.CampaignUpdate request) {
        ReminderCampaign campaign = find(id);
        if (campaign.getStatus() != ReminderCampaign.Status.BROUILLON && campaign.getStatus() != ReminderCampaign.Status.PROGRAMMEE
                && campaign.getDelivery() == ReminderCampaign.Delivery.BOT) {
            throw new BadRequestException("Cette campagne est déjà partie : son message ne peut plus changer.");
        }
        if (campaign.getStatus() == ReminderCampaign.Status.ANNULEE) {
            throw new BadRequestException("Cette campagne est annulée.");
        }
        // Envoi à la main : dès qu'un membre est rappelé, le message des fiches doit rester celui qu'il a reçu.
        if (campaign.getDelivery() == ReminderCampaign.Delivery.MANUEL
                && reminders.findByCampaignIdOrderByIdAsc(id).stream().anyMatch(fiche -> fiche.getContactedAt() != null)) {
            throw new BadRequestException("Des membres ont déjà reçu ce rappel : son message ne peut plus changer.");
        }
        if (request == null) throw new BadRequestException("Modification vide.");
        campaign.setTitle(validTitle(request.title()));
        campaign.setBody(MessageTemplateService.validBody(request.body()));
        campaign.setMediaFile(MessageTemplateService.validMedia(request.mediaFile()));
        if (campaign.getDelivery() == ReminderCampaign.Delivery.BOT) {
            if (request.scheduledAt() != null && request.scheduledAt().isBefore(LocalDateTime.now(OperationLock.ZONE).minusMinutes(1))) {
                throw new BadRequestException("L'heure d'envoi programmée est déjà passée.");
            }
            campaign.setScheduledAt(request.scheduledAt());
            campaign.setStatus(request.scheduledAt() == null ? ReminderCampaign.Status.BROUILLON : ReminderCampaign.Status.PROGRAMMEE);
        }
        campaigns.save(campaign);
        return get(id);
    }

    /** Envoie par le bot une campagne en brouillon ou programmée, sans attendre l'heure prévue. */
    @Transactional
    public MemberActivityDtos.SendResult sendNow(Long id, UUID requestedBy) {
        ReminderCampaign campaign = find(id);
        if (campaign.getDelivery() != ReminderCampaign.Delivery.BOT) {
            throw new BadRequestException("Cette campagne s'envoie à la main : copiez le message depuis chaque fiche.");
        }
        if (campaign.getStatus() != ReminderCampaign.Status.BROUILLON && campaign.getStatus() != ReminderCampaign.Status.PROGRAMMEE) {
            throw new BadRequestException("Cette campagne est déjà partie ou a été annulée.");
        }
        List<MemberReminder> fiches = reminders.findByCampaignIdOrderByIdAsc(id);
        return dispatch(campaign, fiches, users.findAllById(ids(fiches)), requestedBy);
    }

    @Transactional
    public MemberActivityDtos.Campaign cancel(Long id) {
        ReminderCampaign campaign = find(id);
        if (campaign.getStatus() != ReminderCampaign.Status.BROUILLON && campaign.getStatus() != ReminderCampaign.Status.PROGRAMMEE) {
            throw new BadRequestException("Seule une campagne pas encore envoyée peut être annulée.");
        }
        campaign.setStatus(ReminderCampaign.Status.ANNULEE);
        campaign.setScheduledAt(null);
        campaigns.save(campaign);
        return get(id);
    }

    /** Supprime une campagne et ses fiches. Une campagne dont un rappel est parti garde son historique. */
    @Transactional
    public void delete(Long id) {
        ReminderCampaign campaign = find(id);
        boolean anyContact = reminders.findByCampaignIdOrderByIdAsc(id).stream()
                .anyMatch(fiche -> fiche.getContactedAt() != null || fiche.getDeliveryId() != null);
        if (anyContact) throw new BadRequestException("Des membres ont déjà été prévenus : la campagne reste dans l'historique.");
        campaigns.delete(campaign);
    }

    /** Campagnes programmées arrivées à leur heure. */
    @Scheduled(fixedDelayString = "${iceforge.reminders.schedule-check-ms:60000}", initialDelayString = "${iceforge.reminders.schedule-check-ms:60000}")
    @Transactional
    public void sendDueCampaigns() {
        for (ReminderCampaign campaign : campaigns.findByStatusAndScheduledAtLessThanEqual(ReminderCampaign.Status.PROGRAMMEE, LocalDateTime.now(OperationLock.ZONE))) {
            List<MemberReminder> fiches = reminders.findByCampaignIdOrderByIdAsc(campaign.getId());
            MemberActivityDtos.SendResult result = dispatch(campaign, fiches, users.findAllById(ids(fiches)), campaign.getCreatedBy());
            log.info("Campagne de rappel {} envoyée à l'heure prévue : {} message(s), {} ignoré(s)", campaign.getId(), result.queued(), result.skipped().size());
        }
    }

    /** Envoie (ou renvoie, après un échec) le rappel d'une seule fiche par le bot. */
    @Transactional
    public MemberActivityDtos.Reminder resend(Long reminderId, UUID requestedBy, String author) {
        MemberReminder fiche = findReminder(reminderId);
        ReminderCampaign campaign = find(fiche.getCampaignId());
        if (campaign.getStatus() == ReminderCampaign.Status.ANNULEE) throw new BadRequestException("Cette campagne a été annulée.");
        User user = users.findById(fiche.getUserId()).orElseThrow(() -> new BadRequestException("Ce membre a été désactivé."));
        if (fiche.getDeliveryId() != null) {
            DirectMessage previous = directMessages.findById(fiche.getDeliveryId()).orElse(null);
            if (previous != null && previous.getStatus() != DirectMessage.Status.FAILED) {
                throw new BadRequestException("Le rappel est déjà parti ou en cours d'envoi.");
            }
        }
        sendOne(campaign, fiche, user, requestedBy);
        fiche.setUpdatedAt(LocalDateTime.now(OperationLock.ZONE));
        fiche.setUpdatedBy(author);
        reminders.save(fiche);
        return reminderDto(fiche, campaign);
    }

    @Transactional
    public MemberActivityDtos.Reminder updateReminder(Long reminderId, MemberActivityDtos.ReminderUpdate request, String author) {
        if (request == null) throw new BadRequestException("Modification vide.");
        MemberReminder fiche = findReminder(reminderId);
        ReminderCampaign campaign = find(fiche.getCampaignId());
        LocalDateTime now = LocalDateTime.now(OperationLock.ZONE);
        if (request.contacted() != null) {
            if (request.contacted() && fiche.getContactedAt() == null) fiche.setContactedAt(now);
            if (!request.contacted()) {
                if (fiche.getDeliveryId() != null) throw new BadRequestException("Ce rappel a été envoyé par le bot : il reste noté comme envoyé.");
                fiche.setContactedAt(null);
            }
        }
        if (request.answered() != null) {
            fiche.setAnsweredAt(request.answered() ? Optional.ofNullable(fiche.getAnsweredAt()).orElse(now) : null);
        }
        if (request.decision() != null) {
            MemberReminder.Decision decision = parseDecision(request.decision());
            if (decision == MemberReminder.Decision.PAUSE && request.pauseUntil() == null) {
                throw new BadRequestException("Indiquez jusqu'à quand le membre est en pause.");
            }
            if (decision == MemberReminder.Decision.PAUSE && request.pauseUntil().isBefore(LocalDate.now(OperationLock.ZONE))) {
                throw new BadRequestException("La fin de la pause est déjà passée.");
            }
            fiche.setDecision(decision);
            fiche.setPauseUntil(decision == MemberReminder.Decision.PAUSE ? request.pauseUntil() : null);
            if (decision != null && decision != MemberReminder.Decision.SANS_REPONSE && fiche.getAnsweredAt() == null) fiche.setAnsweredAt(now);
            if (decision != null && fiche.getContactedAt() == null && fiche.getDeliveryId() == null) fiche.setContactedAt(now);
            applyDecision(fiche, decision, author);
        }
        if (request.note() != null) {
            String note = request.note().isBlank() ? null : request.note().strip();
            if (note != null && note.length() > 500) throw new BadRequestException("La note dépasse 500 caractères.");
            fiche.setNote(note);
        }
        fiche.setUpdatedAt(now);
        fiche.setUpdatedBy(author);
        reminders.save(fiche);
        return reminderDto(fiche, campaign);
    }

    /** Un rappel confirmé par Discord marque la fiche « rappelé ». */
    @EventListener
    @Transactional
    public void onDirectMessageResult(DirectMessageResultEvent event) {
        if (!ORIGIN.equals(event.origin())) return;
        reminders.findByDeliveryId(event.deliveryId()).ifPresent(fiche -> {
            if (event.status() == DirectMessage.Status.SENT && fiche.getContactedAt() == null) {
                fiche.setContactedAt(LocalDateTime.now(OperationLock.ZONE));
                reminders.save(fiche);
            }
        });
    }

    /**
     * Revient : noté actif le temps du délai « à surveiller », pour ne pas être rappelé aussitôt.
     * Pause : noté en pause jusqu'à la date donnée. Quitte la corpo : rien d'automatique, la désactivation reste un choix.
     */
    private void applyDecision(MemberReminder fiche, MemberReminder.Decision decision, String author) {
        if (decision == MemberReminder.Decision.REVIENT) {
            activity.markFromReminder(fiche.getUserId(), MemberFollowUp.ManualState.ACTIF,
                    LocalDate.now(OperationLock.ZONE).plusDays(activity.settings().getWatchDays()), author);
        } else if (decision == MemberReminder.Decision.PAUSE) {
            activity.markFromReminder(fiche.getUserId(), MemberFollowUp.ManualState.EN_PAUSE, fiche.getPauseUntil(), author);
        }
    }

    private MemberActivityDtos.SendResult dispatch(ReminderCampaign campaign, List<MemberReminder> fiches, List<User> members, UUID requestedBy) {
        Map<UUID, User> byId = members.stream().collect(Collectors.toMap(User::getId, Function.identity()));
        int queued = 0;
        List<String> skipped = new ArrayList<>();
        for (MemberReminder fiche : fiches) {
            User user = byId.get(fiche.getUserId());
            if (user == null) {
                skipped.add("Membre désactivé");
                continue;
            }
            if (fiche.getDeliveryId() != null || fiche.getContactedAt() != null) continue;
            if (user.getDiscordId() == null || !user.getDiscordId().matches("\\d{5,25}")) {
                skipped.add(user.getUsername() + " (identifiant Discord invalide)");
                continue;
            }
            sendOne(campaign, fiche, user, requestedBy);
            queued++;
        }
        reminders.saveAll(fiches);
        campaign.setStatus(ReminderCampaign.Status.EN_COURS);
        campaign.setSentAt(LocalDateTime.now(OperationLock.ZONE));
        campaigns.save(campaign);
        return new MemberActivityDtos.SendResult(queued, skipped);
    }

    private void sendOne(ReminderCampaign campaign, MemberReminder fiche, User user, UUID requestedBy) {
        DirectMessage message = directMessageService.send(new DirectMessageService.Request(user, ORIGIN, String.valueOf(fiche.getId()),
                MessageTemplateService.render(campaign.getBody(), user, null), null, campaign.getMediaFile(), requestedBy));
        fiche.setDeliveryId(message.getId());
    }

    private MemberActivityDtos.Reminder reminderDto(MemberReminder fiche, ReminderCampaign campaign) {
        User user = users.findByIdIncludingInactive(fiche.getUserId()).orElse(null);
        DirectMessage delivery = fiche.getDeliveryId() == null ? null : directMessages.findById(fiche.getDeliveryId()).orElse(null);
        return toReminder(fiche, campaign, user, delivery, campaign.getBody(), activity.pulse(List.of(fiche.getUserId())).get(fiche.getUserId()));
    }

    /** Revenu depuis le rappel : une visite du site ou une opération après la date où il a été prévenu. */
    static Boolean cameBack(MemberReminder fiche, MemberActivityService.Pulse pulse) {
        if (fiche.getContactedAt() == null || pulse == null) return null;
        return pulse.lastActivity() != null && pulse.lastActivity().isAfter(fiche.getContactedAt());
    }

    static MemberActivityDtos.Reminder toReminder(MemberReminder fiche, ReminderCampaign campaign, User user, DirectMessage delivery, String body,
                                                  MemberActivityService.Pulse pulse) {
        return new MemberActivityDtos.Reminder(fiche.getId(), campaign.getId(), campaign.getTitle(), campaign.getDelivery().name(), fiche.getUserId(),
                user == null ? "Membre supprimé" : user.getUsername(), user == null ? null : user.getAvatarUrl(), user == null ? null : user.getDiscordId(),
                fiche.getDaysInactive(), fiche.getContactedAt(), fiche.getAnsweredAt(), fiche.getDecision() == null ? null : fiche.getDecision().name(),
                fiche.getPauseUntil(), fiche.getNote(), delivery == null ? null : delivery.getStatus().name(), delivery == null ? null : delivery.getReason(),
                body == null || user == null ? null : MessageTemplateService.render(body, user, null), fiche.getUpdatedAt(), fiche.getUpdatedBy(),
                pulse == null ? null : new MemberActivityDtos.Today(pulse.state(), pulse.lastActivity(), cameBack(fiche, pulse)));
    }

    private MemberActivityDtos.Campaign toCampaign(ReminderCampaign campaign, List<MemberReminder> fiches, Map<UUID, DirectMessage> deliveries,
                                                   Map<UUID, User> members, Map<UUID, MemberActivityService.Pulse> pulses) {
        int contacted = 0, pending = 0, failed = 0, answered = 0, cameBack = 0;
        Map<String, Integer> decisions = new LinkedHashMap<>();
        Map<String, Integer> states = new LinkedHashMap<>();
        for (MemberReminder fiche : fiches) {
            DirectMessage delivery = fiche.getDeliveryId() == null ? null : deliveries.get(fiche.getDeliveryId());
            if (fiche.getContactedAt() != null) contacted++;
            if (delivery != null && delivery.getStatus() == DirectMessage.Status.PENDING) pending++;
            if (delivery != null && delivery.getStatus() == DirectMessage.Status.FAILED && fiche.getContactedAt() == null) failed++;
            if (fiche.getAnsweredAt() != null) answered++;
            if (fiche.getDecision() != null) decisions.merge(fiche.getDecision().name(), 1, Integer::sum);
            MemberActivityService.Pulse pulse = pulses.get(fiche.getUserId());
            if (Boolean.TRUE.equals(cameBack(fiche, pulse))) cameBack++;
            if (pulse != null) states.merge(pulse.state(), 1, Integer::sum);
        }
        List<MemberActivityDtos.Reminder> reminderDtos = members == null ? null : fiches.stream()
                .map(fiche -> toReminder(fiche, campaign, members.get(fiche.getUserId()), fiche.getDeliveryId() == null ? null : deliveries.get(fiche.getDeliveryId()), campaign.getBody(), pulses.get(fiche.getUserId())))
                .toList();
        return new MemberActivityDtos.Campaign(campaign.getId(), campaign.getTitle(), campaign.getBody(), campaign.getMediaFile(),
                templates.mediaUrl(campaign.getMediaFile()), campaign.getDelivery().name(), campaign.getStatus().name(), campaign.getScheduledAt(),
                campaign.getSentAt(), campaign.getCreatedByName(), campaign.getCreatedAt(),
                new MemberActivityDtos.CampaignCounts(fiches.size(), contacted, pending, failed, answered, decisions, cameBack, states), reminderDtos);
    }

    private Map<UUID, DirectMessage> deliveries(Collection<MemberReminder> fiches) {
        Set<UUID> ids = fiches.stream().map(MemberReminder::getDeliveryId).filter(Objects::nonNull).collect(Collectors.toSet());
        return ids.isEmpty() ? Map.of() : directMessages.findByIdIn(ids).stream().collect(Collectors.toMap(DirectMessage::getId, Function.identity()));
    }

    private static List<UUID> ids(List<MemberReminder> fiches) {
        return fiches.stream().map(MemberReminder::getUserId).distinct().toList();
    }

    private ReminderCampaign find(Long id) {
        return campaigns.findById(id).orElseThrow(() -> new ResourceNotFoundException("Campagne de rappel introuvable."));
    }

    private MemberReminder findReminder(Long id) {
        return reminders.findById(id).orElseThrow(() -> new ResourceNotFoundException("Fiche de rappel introuvable."));
    }

    private static String validTitle(String title) {
        if (title == null || title.isBlank()) throw new BadRequestException("Donnez un titre à la campagne.");
        if (title.strip().length() > 120) throw new BadRequestException("Le titre dépasse 120 caractères.");
        return title.strip();
    }

    private static ReminderCampaign.Delivery parseDelivery(String value) {
        try {
            return ReminderCampaign.Delivery.valueOf(value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new BadRequestException("Choisissez l'envoi : par le bot ou à la main.");
        }
    }

    private static MemberReminder.Decision parseDecision(String value) {
        if (value.isBlank()) return null;
        try {
            return MemberReminder.Decision.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new BadRequestException("Décision inconnue : " + value);
        }
    }
}
