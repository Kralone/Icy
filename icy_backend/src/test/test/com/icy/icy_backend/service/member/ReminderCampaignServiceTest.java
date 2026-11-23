package com.icy.icy_backend.service.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.db.entity.member.*;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.DirectMessageRepository;
import com.icy.icy_backend.db.repository.member.MemberReminderRepository;
import com.icy.icy_backend.db.repository.member.MessageTemplateRepository;
import com.icy.icy_backend.db.repository.member.ReminderCampaignRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.messaging.DirectMessageResultEvent;
import com.icy.icy_backend.messaging.DirectMessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReminderCampaignServiceTest {
    private ReminderCampaignRepository campaigns;
    private MemberReminderRepository reminders;
    private DirectMessageRepository directMessages;
    private UserRepository users;
    private DirectMessageService directMessageService;
    private MemberActivityService activity;
    private ReminderCampaignService service;
    private final Map<Long, ReminderCampaign> campaignStore = new HashMap<>();
    private final Map<Long, MemberReminder> reminderStore = new LinkedHashMap<>();
    private final AtomicLong ids = new AtomicLong();
    private User vexa;
    private User torin;

    @BeforeEach
    void setUp() {
        campaigns = mock(ReminderCampaignRepository.class);
        reminders = mock(MemberReminderRepository.class);
        directMessages = mock(DirectMessageRepository.class);
        users = mock(UserRepository.class);
        directMessageService = mock(DirectMessageService.class);
        activity = mock(MemberActivityService.class);
        MessageTemplateService templates = new MessageTemplateService(mock(MessageTemplateRepository.class), "https://iceforge.fr/images/");
        service = new ReminderCampaignService(campaigns, reminders, directMessages, users, directMessageService, activity, templates);

        vexa = user("Vexa", "190174996235026433");
        torin = user("Torin", "290174996235026433");
        when(users.findAllById(any())).thenAnswer(invocation -> {
            Collection<UUID> wanted = invocation.getArgument(0);
            return List.of(vexa, torin).stream().filter(user -> wanted.contains(user.getId())).toList();
        });
        when(users.findAllByIdIncludingInactive(any())).thenAnswer(invocation -> List.of(vexa, torin));
        when(users.findById(vexa.getId())).thenReturn(Optional.of(vexa));
        when(users.findByIdIncludingInactive(vexa.getId())).thenReturn(Optional.of(vexa));
        when(campaigns.save(any())).thenAnswer(invocation -> {
            ReminderCampaign campaign = invocation.getArgument(0);
            if (campaign.getId() == null) campaign.setId(ids.incrementAndGet());
            campaignStore.put(campaign.getId(), campaign);
            return campaign;
        });
        when(campaigns.findById(anyLong())).thenAnswer(invocation -> Optional.ofNullable(campaignStore.get(invocation.<Long>getArgument(0))));
        when(reminders.saveAll(any())).thenAnswer(invocation -> {
            List<MemberReminder> saved = new ArrayList<>();
            for (MemberReminder reminder : invocation.<Iterable<MemberReminder>>getArgument(0)) saved.add(store(reminder));
            return saved;
        });
        when(reminders.save(any())).thenAnswer(invocation -> store(invocation.getArgument(0)));
        when(reminders.findById(anyLong())).thenAnswer(invocation -> Optional.ofNullable(reminderStore.get(invocation.<Long>getArgument(0))));
        when(reminders.findByCampaignIdOrderByIdAsc(anyLong())).thenAnswer(invocation -> reminderStore.values().stream()
                .filter(reminder -> reminder.getCampaignId().equals(invocation.getArgument(0))).toList());
        when(activity.daysInactive(any())).thenReturn(Map.of(vexa.getId(), 45, torin.getId(), 32));
        MemberActivitySettings settings = new MemberActivitySettings();
        when(activity.settings()).thenReturn(settings);
        when(directMessageService.send(any())).thenAnswer(invocation -> DirectMessage.builder().id(UUID.randomUUID())
                .status(DirectMessage.Status.PENDING).build());
    }

    private MemberReminder store(MemberReminder reminder) {
        if (reminder.getId() == null) reminder.setId(ids.incrementAndGet());
        reminderStore.put(reminder.getId(), reminder);
        return reminder;
    }

    private static User user(String name, String discordId) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(name);
        user.setDiscordId(discordId);
        return user;
    }

    private MemberActivityDtos.CampaignCreate create(String delivery, Boolean sendNow, LocalDateTime scheduledAt) {
        return new MemberActivityDtos.CampaignCreate("Rappel de novembre", "Hello {pseudo} ! 👋", "rappel-inactivite.gif", delivery,
                List.of(vexa.getId(), torin.getId()), scheduledAt, sendNow);
    }

    @Test
    void aManualCampaignGivesEachMemberAFicheWithHisOwnMessage() {
        MemberActivityDtos.Campaign campaign = service.create(create("MANUEL", null, null), UUID.randomUUID(), "Kralone");

        assertThat(campaign.status()).isEqualTo("EN_COURS");
        assertThat(campaign.reminders()).extracting(MemberActivityDtos.Reminder::message)
                .containsExactly("Hello Torin ! 👋", "Hello Vexa ! 👋");
        assertThat(campaign.reminders()).extracting(MemberActivityDtos.Reminder::daysInactive).containsExactly(32, 45);
        assertThat(campaign.mediaUrl()).isEqualTo("https://iceforge.fr/images/rappel-inactivite.gif");
        verifyNoInteractions(directMessageService);
    }

    @Test
    void sendingByTheBotPersonalisesEachMessageAndKeepsTheGif() {
        service.create(create("BOT", true, null), UUID.randomUUID(), "Kralone");

        ArgumentCaptor<DirectMessageService.Request> sent = ArgumentCaptor.forClass(DirectMessageService.Request.class);
        verify(directMessageService, times(2)).send(sent.capture());
        assertThat(sent.getAllValues()).extracting(DirectMessageService.Request::content).containsExactly("Hello Torin ! 👋", "Hello Vexa ! 👋");
        assertThat(sent.getAllValues()).allMatch(request -> "rappel-inactivite.gif".equals(request.mediaFile()) && "REMINDER".equals(request.origin()));
        assertThat(reminderStore.values()).allMatch(reminder -> reminder.getDeliveryId() != null && reminder.getContactedAt() == null);
        assertThat(campaignStore.values()).allMatch(campaign -> campaign.getStatus() == ReminderCampaign.Status.EN_COURS);
    }

    @Test
    void aScheduledCampaignWaitsForItsTime() {
        LocalDateTime tomorrow = LocalDateTime.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1);
        MemberActivityDtos.Campaign campaign = service.create(create("BOT", false, tomorrow), UUID.randomUUID(), "Kralone");

        assertThat(campaign.status()).isEqualTo("PROGRAMMEE");
        verifyNoInteractions(directMessageService);

        ReminderCampaign stored = campaignStore.get(campaign.id());
        when(campaigns.findByStatusAndScheduledAtLessThanEqual(eq(ReminderCampaign.Status.PROGRAMMEE), any())).thenReturn(List.of(stored));
        service.sendDueCampaigns();

        verify(directMessageService, times(2)).send(any());
        assertThat(stored.getStatus()).isEqualTo(ReminderCampaign.Status.EN_COURS);
    }

    @Test
    void aScheduleInThePastIsRefused() {
        assertThatThrownBy(() -> service.create(create("BOT", false, LocalDateTime.now(java.time.ZoneId.of("Europe/Paris")).minusHours(1)), UUID.randomUUID(), "Kralone"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void discordConfirmationMarksTheFicheAsContacted() {
        service.create(create("BOT", true, null), UUID.randomUUID(), "Kralone");
        MemberReminder fiche = reminderStore.values().iterator().next();
        when(reminders.findByDeliveryId(fiche.getDeliveryId())).thenReturn(Optional.of(fiche));

        service.onDirectMessageResult(new DirectMessageResultEvent(fiche.getDeliveryId(), fiche.getUserId(), "REMINDER", "1", DirectMessage.Status.SENT, null));

        assertThat(fiche.getContactedAt()).isNotNull();
    }

    @Test
    void aPauseNeedsAnEndDateAndMarksTheMemberAway() {
        service.create(create("MANUEL", null, null), UUID.randomUUID(), "Kralone");
        MemberReminder fiche = reminderStore.values().stream().filter(reminder -> reminder.getUserId().equals(vexa.getId())).findFirst().orElseThrow();

        assertThatThrownBy(() -> service.updateReminder(fiche.getId(), new MemberActivityDtos.ReminderUpdate(null, null, "PAUSE", null, null), "Kralone"))
                .isInstanceOf(BadRequestException.class);

        LocalDate until = LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusMonths(2);
        MemberActivityDtos.Reminder updated = service.updateReminder(fiche.getId(),
                new MemberActivityDtos.ReminderUpdate(null, null, "PAUSE", until, "Déménagement"), "Kralone");

        assertThat(updated.decision()).isEqualTo("PAUSE");
        assertThat(updated.answeredAt()).isNotNull();
        assertThat(updated.contactedAt()).isNotNull();
        assertThat(updated.note()).isEqualTo("Déménagement");
        verify(activity).markFromReminder(vexa.getId(), MemberFollowUp.ManualState.EN_PAUSE, until, "Kralone");
    }

    @Test
    void aReturningMemberIsNotRemindedRightAway() {
        service.create(create("MANUEL", null, null), UUID.randomUUID(), "Kralone");
        MemberReminder fiche = reminderStore.values().stream().filter(reminder -> reminder.getUserId().equals(vexa.getId())).findFirst().orElseThrow();

        service.updateReminder(fiche.getId(), new MemberActivityDtos.ReminderUpdate(true, true, "REVIENT", null, null), "Kralone");

        verify(activity).markFromReminder(vexa.getId(), MemberFollowUp.ManualState.ACTIF, LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(14), "Kralone");
    }

    @Test
    void aCampaignAlreadySentCannotBeDeleted() {
        MemberActivityDtos.Campaign campaign = service.create(create("BOT", true, null), UUID.randomUUID(), "Kralone");

        assertThatThrownBy(() -> service.delete(campaign.id())).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.cancel(campaign.id())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void aFailedReminderCanBeSentAgain() {
        service.create(create("BOT", true, null), UUID.randomUUID(), "Kralone");
        MemberReminder fiche = reminderStore.values().stream().filter(reminder -> reminder.getUserId().equals(vexa.getId())).findFirst().orElseThrow();
        UUID first = fiche.getDeliveryId();
        when(directMessages.findById(first)).thenReturn(Optional.of(DirectMessage.builder().id(first).status(DirectMessage.Status.PENDING).build()));
        assertThatThrownBy(() -> service.resend(fiche.getId(), UUID.randomUUID(), "Kralone")).isInstanceOf(BadRequestException.class);

        when(directMessages.findById(first)).thenReturn(Optional.of(DirectMessage.builder().id(first).status(DirectMessage.Status.FAILED).reason("dm_closed").build()));
        service.resend(fiche.getId(), UUID.randomUUID(), "Kralone");

        assertThat(fiche.getDeliveryId()).isNotEqualTo(first);
    }
}
