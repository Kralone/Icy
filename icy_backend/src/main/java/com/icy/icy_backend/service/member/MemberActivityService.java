package com.icy.icy_backend.service.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.controller.dto.member.MemberActivityDtos.State;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.member.MemberActivitySettings;
import com.icy.icy_backend.db.entity.member.MemberFollowUp;
import com.icy.icy_backend.db.entity.member.MemberReminder;
import com.icy.icy_backend.db.entity.member.MessageTemplate;
import com.icy.icy_backend.db.entity.member.ReminderCampaign;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.*;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Activité des membres : depuis combien de jours chacun n'a ni ouvert le site ni participé à une opération,
 * corrigée à la main quand le calcul se trompe (absence prévenue, joueur actif sur Discord seulement).
 */
@Service
@RequiredArgsConstructor
public class MemberActivityService {
    private final UserRepository users;
    private final MemberActivitySettingsRepository settingsRepository;
    private final MemberFollowUpRepository followUps;
    private final MemberReminderRepository reminders;
    private final ReminderCampaignRepository campaigns;
    private final DirectMessageRepository directMessages;
    private final MessageTemplateRepository templates;

    @Transactional(readOnly = true)
    public MemberActivitySettings settings() {
        return settingsRepository.findById(MemberActivitySettings.SINGLE_ID).orElseGet(MemberActivitySettings::new);
    }

    @Transactional
    public MemberActivityDtos.Settings updateSettings(MemberActivityDtos.Settings request) {
        if (request == null || request.watchDays() < 1 || request.inactiveDays() <= request.watchDays() || request.inactiveDays() > 365) {
            throw new BadRequestException("Seuils invalides : « à surveiller » dès 1 jour, « inactif » plus tard, au plus 365 jours.");
        }
        MemberActivitySettings settings = settings();
        settings.setWatchDays(request.watchDays());
        settings.setInactiveDays(request.inactiveDays());
        settingsRepository.save(settings);
        return new MemberActivityDtos.Settings(settings.getWatchDays(), settings.getInactiveDays());
    }

    @Transactional(readOnly = true)
    public MemberActivityDtos.Overview overview() {
        LocalDateTime now = LocalDateTime.now();
        MemberActivitySettings settings = settings();
        Map<UUID, LocalDateTime> lastOperations = followUps.findLastConfirmedParticipations(now).stream()
                .filter(row -> row.getUserId() != null && row.getLastAt() != null)
                .collect(Collectors.toMap(MemberFollowUpRepository.LastParticipation::getUserId,
                        MemberFollowUpRepository.LastParticipation::getLastAt, (left, right) -> left.isAfter(right) ? left : right));
        Map<UUID, MemberFollowUp> manual = followUps.findAll().stream().collect(Collectors.toMap(MemberFollowUp::getUserId, Function.identity()));
        Map<UUID, MemberReminder> latest = reminders.findLatestPerMember().stream()
                .collect(Collectors.toMap(MemberReminder::getUserId, Function.identity()));
        Map<Long, ReminderCampaign> campaignById = latest.isEmpty() ? Map.of() : campaigns.findAllById(
                latest.values().stream().map(MemberReminder::getCampaignId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(ReminderCampaign::getId, Function.identity()));
        Map<UUID, DirectMessage> deliveries = deliveries(latest.values());

        List<MemberActivityDtos.Member> members = users.findAll().stream()
                .sorted(Comparator.comparing(user -> Optional.ofNullable(user.getUsername()).orElse("").toLowerCase(Locale.ROOT)))
                .map(user -> toMember(user, now, settings, lastOperations.get(user.getId()), manual.get(user.getId()),
                        latest.get(user.getId()), campaignById, deliveries))
                .toList();
        return new MemberActivityDtos.Overview(new MemberActivityDtos.Settings(settings.getWatchDays(), settings.getInactiveDays()), members);
    }

    /** Jours sans activité de chaque membre actif, pour figer la valeur sur une fiche de rappel. */
    @Transactional(readOnly = true)
    public Map<UUID, Integer> daysInactive(Collection<UUID> userIds) {
        LocalDateTime now = LocalDateTime.now();
        Map<UUID, LocalDateTime> lastOperations = followUps.findLastConfirmedParticipations(now).stream()
                .collect(Collectors.toMap(MemberFollowUpRepository.LastParticipation::getUserId,
                        MemberFollowUpRepository.LastParticipation::getLastAt, (left, right) -> left));
        Map<UUID, Integer> result = new HashMap<>();
        users.findAllById(userIds).forEach(user -> result.put(user.getId(), days(lastActivity(user, lastOperations.get(user.getId())), user, now)));
        return result;
    }

    @Transactional
    public MemberActivityDtos.Manual updateFollowUp(UUID userId, MemberActivityDtos.FollowUpRequest request, String author) {
        users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable."));
        MemberFollowUp.ManualState state = parseManual(request == null ? null : request.state());
        String note = request == null || request.note() == null || request.note().isBlank() ? null : request.note().strip();
        if (note != null && note.length() > 500) throw new BadRequestException("La note dépasse 500 caractères.");
        if (state == MemberFollowUp.ManualState.EN_PAUSE && request.until() != null && request.until().isBefore(LocalDate.now())) {
            throw new BadRequestException("La fin de la pause est déjà passée.");
        }
        MemberFollowUp followUp = followUps.findById(userId).orElseGet(() -> MemberFollowUp.builder().userId(userId).build());
        followUp.setManualState(state);
        followUp.setManualUntil(state == null ? null : request.until());
        followUp.setNote(note);
        followUp.setUpdatedAt(LocalDateTime.now());
        followUp.setUpdatedBy(author);
        followUps.save(followUp);
        return toManual(followUp);
    }

    /** Note un membre actif ou en pause, à la suite d'une réponse à un rappel. */
    @Transactional
    public void markFromReminder(UUID userId, MemberFollowUp.ManualState state, LocalDate until, String author) {
        MemberFollowUp followUp = followUps.findById(userId).orElseGet(() -> MemberFollowUp.builder().userId(userId).build());
        followUp.setManualState(state);
        followUp.setManualUntil(until);
        followUp.setUpdatedAt(LocalDateTime.now());
        followUp.setUpdatedBy(author);
        followUps.save(followUp);
    }

    @Transactional(readOnly = true)
    public MemberActivityDtos.History history(UUID userId) {
        User user = users.findByIdIncludingInactive(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable."));
        List<MemberReminder> userReminders = reminders.findByUserIdOrderByIdDesc(userId);
        Map<Long, ReminderCampaign> campaignById = campaigns.findAllById(userReminders.stream().map(MemberReminder::getCampaignId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(ReminderCampaign::getId, Function.identity()));
        Map<UUID, DirectMessage> deliveries = deliveries(userReminders);
        List<MemberActivityDtos.Reminder> reminderDtos = userReminders.stream()
                .filter(reminder -> campaignById.containsKey(reminder.getCampaignId()))
                .map(reminder -> ReminderCampaignService.toReminder(reminder, campaignById.get(reminder.getCampaignId()), user, reminder.getDeliveryId() == null ? null : deliveries.get(reminder.getDeliveryId()), null))
                .toList();

        List<DirectMessage> sent = directMessages.findTop20ByUserIdOrderByRequestedAtDesc(userId);
        Map<String, String> labels = templates.findAll().stream().collect(Collectors.toMap(MessageTemplate::getCode, MessageTemplate::getLabel));
        Set<UUID> requesterIds = sent.stream().map(DirectMessage::getRequestedBy).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> requesters = requesterIds.isEmpty() ? Map.of() : users.findAllByIdIncludingInactive(requesterIds).stream()
                .collect(Collectors.toMap(User::getId, User::getUsername));
        List<MemberActivityDtos.DirectMessage> messageDtos = sent.stream().map(message -> new MemberActivityDtos.DirectMessage(
                message.getId(), message.getOrigin(), message.getReference(), label(message, labels), message.getStatus().name(), message.getReason(),
                message.getRequestedAt(), message.getCompletedAt(), requesters.get(message.getRequestedBy()))).toList();
        return new MemberActivityDtos.History(user.getId(), user.getUsername(), reminderDtos, messageDtos);
    }

    private static String label(DirectMessage message, Map<String, String> templateLabels) {
        if ("REMINDER".equals(message.getOrigin())) return "Rappel d'inactivité";
        if (message.getReference() != null && templateLabels.containsKey(message.getReference())) return templateLabels.get(message.getReference());
        if (message.getEmbedTitle() != null) return message.getEmbedTitle();
        return switch (message.getOrigin()) {
            case "PROMOTION" -> "Promotion";
            case "WARNING" -> "Avertissement";
            default -> "Message";
        };
    }

    private Map<UUID, DirectMessage> deliveries(Collection<MemberReminder> list) {
        Set<UUID> ids = list.stream().map(MemberReminder::getDeliveryId).filter(Objects::nonNull).collect(Collectors.toSet());
        return ids.isEmpty() ? Map.of() : directMessages.findByIdIn(ids).stream().collect(Collectors.toMap(DirectMessage::getId, Function.identity()));
    }

    static LocalDateTime lastActivity(User user, LocalDateTime lastOperation) {
        LocalDateTime seen = user.getLastSeenAt();
        if (seen == null) return lastOperation;
        if (lastOperation == null) return seen;
        return seen.isAfter(lastOperation) ? seen : lastOperation;
    }

    /** Jours écoulés depuis la dernière activité ; depuis la création du compte pour un membre jamais venu. */
    static int days(LocalDateTime lastActivity, User user, LocalDateTime now) {
        LocalDateTime since = lastActivity != null ? lastActivity : user.getCreatedAt();
        if (since == null || since.isAfter(now)) return 0;
        return (int) Duration.between(since, now).toDays();
    }

    static State computedState(int days, MemberActivitySettings settings) {
        if (days >= settings.getInactiveDays()) return State.INACTIF;
        if (days >= settings.getWatchDays()) return State.A_SURVEILLER;
        return State.ACTIF;
    }

    private MemberActivityDtos.Member toMember(User user, LocalDateTime now, MemberActivitySettings settings, LocalDateTime lastOperation,
                                               MemberFollowUp manual, MemberReminder reminder, Map<Long, ReminderCampaign> campaignById,
                                               Map<UUID, DirectMessage> deliveries) {
        LocalDateTime lastActivity = lastActivity(user, lastOperation);
        int days = days(lastActivity, user, now);
        State computed = computedState(days, settings);
        State state = computed;
        if (manual != null && manual.appliesOn(now.toLocalDate())) {
            state = manual.getManualState() == MemberFollowUp.ManualState.EN_PAUSE ? State.EN_PAUSE : State.ACTIF;
        }
        MemberActivityDtos.ReminderSummary summary = null;
        if (reminder != null) {
            ReminderCampaign campaign = campaignById.get(reminder.getCampaignId());
            DirectMessage delivery = reminder.getDeliveryId() == null ? null : deliveries.get(reminder.getDeliveryId());
            summary = new MemberActivityDtos.ReminderSummary(reminder.getId(), reminder.getCampaignId(), campaign == null ? null : campaign.getTitle(),
                    reminder.getContactedAt(), reminder.getAnsweredAt(), reminder.getDecision() == null ? null : reminder.getDecision().name(),
                    reminder.getPauseUntil(), delivery == null ? null : delivery.getStatus().name(), delivery == null ? null : delivery.getReason());
        }
        return new MemberActivityDtos.Member(user.getId(), user.getUsername(), user.getAvatarUrl(), user.getDiscordId(), MemberRanks.roleNames(user),
                user.getSpecialty() == null ? null : user.getSpecialty().name(), user.getCreatedAt(), user.getLastSeenAt(), lastOperation, lastActivity,
                days, computed, state, manual == null || manual.getManualState() == null && manual.getNote() == null ? null : toManual(manual), summary);
    }

    private static MemberActivityDtos.Manual toManual(MemberFollowUp followUp) {
        return new MemberActivityDtos.Manual(followUp.getManualState() == null ? null : followUp.getManualState().name(), followUp.getManualUntil(),
                followUp.getNote(), followUp.getUpdatedAt(), followUp.getUpdatedBy());
    }

    private static MemberFollowUp.ManualState parseManual(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return MemberFollowUp.ManualState.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new BadRequestException("État inconnu : " + value);
        }
    }
}
