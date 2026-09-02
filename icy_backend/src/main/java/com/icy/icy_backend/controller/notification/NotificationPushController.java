package com.icy.icy_backend.controller.notification;

import com.icy.icy_backend.controller.dto.notification.NotificationSendRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationSubscriptionRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationTestPushRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationUnsubscribeRequest;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications/push")
public class NotificationPushController {
    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationPushController.class);
    private final NotificationPushService pushService;

    public NotificationPushController(NotificationPushService pushService) {
        this.pushService = pushService;
    }

    @GetMapping("/public-key")
    public ResponseEntity<String> getPublicKey() {
        LOGGER.info("Push public key requested");
        return ResponseEntity.ok(pushService.getPublicKey());
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@RequestBody NotificationSubscriptionRequest request) {
        LOGGER.info("Push subscribe request received");
        pushService.subscribe(AuthUtils.getCurrentUserId(), request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/subscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody NotificationUnsubscribeRequest request) {
        LOGGER.info("Push unsubscribe request received");
        pushService.unsubscribe(AuthUtils.getCurrentUserId(), request.getEndpoint());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/test")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> sendTest(@RequestBody NotificationTestPushRequest request) {
        LOGGER.info("Push test request received");
        pushService.sendTest(AuthUtils.getCurrentUserId(), request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> send(@RequestBody NotificationSendRequest request) {
        if (request == null) {
            throw new BadRequestException("Notification invalide");
        }
        if (request.isBroadcast()) {
            pushService.sendBroadcast(request.getTitle(), request.getBody(), request.getUrl(), request.getPriority());
            return ResponseEntity.ok().build();
        }
        if (request.getUserIds() == null || request.getUserIds().isEmpty()) {
            throw new BadRequestException("Aucun utilisateur cible");
        }
        pushService.sendToUsers(request.getUserIds(), request.getTitle(), request.getBody(), request.getUrl(), request.getPriority());
        return ResponseEntity.ok().build();
    }
}
