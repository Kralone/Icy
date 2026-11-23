package com.icy.icy_backend.controller.member;

import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.member.MemberActivityService;
import com.icy.icy_backend.service.member.MemberAnnouncementService;
import com.icy.icy_backend.service.member.MessageTemplateService;
import com.icy.icy_backend.service.member.ReminderCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Activité des membres, campagnes et fiches de rappel, modèles de messages et annonces de promotion. Direction et Officiers. */
@RestController
@RequestMapping("/api/member-activity")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class MemberActivityController {
    private final MemberActivityService activity;
    private final ReminderCampaignService campaigns;
    private final MessageTemplateService templates;
    private final MemberAnnouncementService announcements;

    @GetMapping
    public MemberActivityDtos.Overview overview() {
        return activity.overview();
    }

    @PutMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    public MemberActivityDtos.Settings updateSettings(@RequestBody MemberActivityDtos.Settings request) {
        return activity.updateSettings(request);
    }

    @PutMapping("/members/{userId}/follow-up")
    public MemberActivityDtos.Manual updateFollowUp(@PathVariable UUID userId, @RequestBody MemberActivityDtos.FollowUpRequest request) {
        return activity.updateFollowUp(userId, request, currentName());
    }

    @GetMapping("/members/{userId}/history")
    public MemberActivityDtos.History history(@PathVariable UUID userId) {
        return activity.history(userId);
    }

    @PostMapping("/members/{userId}/announce")
    public MemberActivityDtos.DirectMessage announce(@PathVariable UUID userId, @RequestBody MemberActivityDtos.AnnounceRequest request) {
        return announcements.announce(userId, request == null ? null : request.templateCode(), AuthUtils.getCurrentUserId(), currentName());
    }

    @GetMapping("/templates")
    public List<MemberActivityDtos.Template> templates() {
        return templates.list();
    }

    @PutMapping("/templates/{code}")
    public MemberActivityDtos.Template updateTemplate(@PathVariable String code, @RequestBody MemberActivityDtos.TemplateUpdate request) {
        return templates.update(code, request, currentName());
    }

    @GetMapping("/campaigns")
    public List<MemberActivityDtos.Campaign> campaigns() {
        return campaigns.list();
    }

    @GetMapping("/campaigns/{id}")
    public MemberActivityDtos.Campaign campaign(@PathVariable Long id) {
        return campaigns.get(id);
    }

    @PostMapping("/campaigns")
    public MemberActivityDtos.Campaign create(@RequestBody MemberActivityDtos.CampaignCreate request) {
        return campaigns.create(request, AuthUtils.getCurrentUserId(), currentName());
    }

    @PutMapping("/campaigns/{id}")
    public MemberActivityDtos.Campaign update(@PathVariable Long id, @RequestBody MemberActivityDtos.CampaignUpdate request) {
        return campaigns.update(id, request);
    }

    @PostMapping("/campaigns/{id}/send")
    public MemberActivityDtos.SendResult send(@PathVariable Long id) {
        return campaigns.sendNow(id, AuthUtils.getCurrentUserId());
    }

    @PostMapping("/campaigns/{id}/cancel")
    public MemberActivityDtos.Campaign cancel(@PathVariable Long id) {
        return campaigns.cancel(id);
    }

    @DeleteMapping("/campaigns/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        campaigns.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reminders/{id}")
    public MemberActivityDtos.Reminder updateReminder(@PathVariable Long id, @RequestBody MemberActivityDtos.ReminderUpdate request) {
        return campaigns.updateReminder(id, request, currentName());
    }

    @PostMapping("/reminders/{id}/send")
    public MemberActivityDtos.Reminder resend(@PathVariable Long id) {
        return campaigns.resend(id, AuthUtils.getCurrentUserId(), currentName());
    }

    private static String currentName() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal instanceof UserAuthDetails details ? details.getUsername() : null;
    }
}
