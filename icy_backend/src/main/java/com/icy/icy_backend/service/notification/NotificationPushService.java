package com.icy.icy_backend.service.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.notification.NotificationSubscriptionRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationTestPushRequest;
import com.icy.icy_backend.db.entity.notification.NotificationSubscription;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.notification.NotificationSubscriptionRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.websocket.NotificationWebSocketService;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.apache.http.HttpResponse;
import org.apache.http.util.EntityUtils;
import org.jose4j.lang.JoseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.GeneralSecurityException;
import java.security.Security;
import java.util.concurrent.ExecutionException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationPushService {
    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationPushService.class);
    private final NotificationSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final NotificationWebSocketService notificationWebSocketService;
    private final PushService pushService;
    private final String publicKey;

    public NotificationPushService(
            NotificationSubscriptionRepository subscriptionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            NotificationWebSocketService notificationWebSocketService,
            @Value("${push.vapid.public-key}") String publicKey,
            @Value("${push.vapid.private-key}") String privateKey,
            @Value("${push.vapid.subject}") String subject
    ) throws GeneralSecurityException {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.notificationWebSocketService = notificationWebSocketService;
        this.publicKey = publicKey == null ? "" : publicKey;

        if (this.publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            LOGGER.warn("Push VAPID keys missing or empty. Push disabled.");
            this.pushService = null;
            return;
        }

        Security.addProvider(new BouncyCastleProvider());
        this.pushService = new PushService();
        this.pushService.setPublicKey(Utils.loadPublicKey(this.publicKey));
        this.pushService.setPrivateKey(Utils.loadPrivateKey(privateKey));
        this.pushService.setSubject(subject);
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void subscribe(UUID userId, NotificationSubscriptionRequest request) {
        if (pushService == null) {
            LOGGER.warn("Push subscribe ignored: VAPID not configured");
            throw new IllegalStateException("VAPID keys non configurees");
        }
        if (request == null || request.getEndpoint() == null || request.getKeys() == null) {
            LOGGER.warn("Push subscribe invalid payload");
            throw new BadRequestException("Subscription invalide");
        }
        LOGGER.info("Push subscribe for user {}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable"));

        NotificationSubscription subscription = subscriptionRepository
                .findByEndpoint(request.getEndpoint())
                .orElseGet(NotificationSubscription::new);

        subscription.setUser(user);
        subscription.setEndpoint(request.getEndpoint());
        subscription.setP256dh(request.getKeys().getP256dh());
        subscription.setAuth(request.getKeys().getAuth());
        subscription.setUserAgent(request.getUserAgent());

        subscriptionRepository.save(subscription);
        LOGGER.info("Push subscription saved {}", subscription.getEndpoint());
    }

    public void unsubscribe(UUID userId, String endpoint) {
        NotificationSubscription subscription = subscriptionRepository
                .findByEndpoint(endpoint)
                .orElseThrow(() -> new ResourceNotFoundException("Abonnement introuvable"));

        if (!subscription.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Abonnement introuvable");
        }

        subscriptionRepository.delete(subscription);
        LOGGER.info("Push subscription removed {}", endpoint);
    }

    public void sendTest(UUID userId, NotificationTestPushRequest request) {
        String jsonPayload = buildPayload(
                request.getTitle(),
                request.getBody(),
                request.getUrl()
        );

        notificationWebSocketService.sendToUsers(
                List.of(userId),
                request.getTitle(),
                request.getBody(),
                request.getUrl()
        );

        if (pushService == null) {
            return;
        }

        List<NotificationSubscription> subs = subscriptionRepository.findByUserId(userId);
        if (subs.isEmpty()) {
            return;
        }

        sendToSubscriptions(subs, jsonPayload);
    }

    public void sendToUsers(List<UUID> userIds, String title, String body, String url) {
        if (userIds == null || userIds.isEmpty()) {
            return;
        }

        notificationWebSocketService.sendToUsers(userIds, title, body, url);

        if (pushService == null) {
            return;
        }
        List<NotificationSubscription> subs = subscriptionRepository.findByUserIdIn(userIds);
        if (subs.isEmpty()) {
            return;
        }
        String jsonPayload = buildPayload(title, body, url);
        sendToSubscriptions(subs, jsonPayload);
    }

    public void sendBroadcast(String title, String body, String url) {
        notificationWebSocketService.sendBroadcast(title, body, url);
        if (pushService == null) {
            return;
        }
        List<NotificationSubscription> subs = subscriptionRepository.findAll();
        if (subs.isEmpty()) {
            return;
        }
        String jsonPayload = buildPayload(title, body, url);
        sendToSubscriptions(subs, jsonPayload);
    }

    private String buildPayload(String title, String body, String url) {
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> notification = new HashMap<>();
        String resolvedTitle = title == null ? "IceForge" : title;
        String resolvedBody = body == null ? "Nouvelle notification" : body;

        notification.put("title", resolvedTitle);
        notification.put("body", resolvedBody);
        notification.put("icon", "/assets/icons/icon-192x192.png");
        if (url != null && !url.isBlank()) {
            Map<String, Object> data = new HashMap<>();
            data.put("url", url);
            notification.put("data", data);
        }
        payload.put("notification", notification);
        Map<String, Object> dataPayload = new HashMap<>();
        dataPayload.put("title", resolvedTitle);
        dataPayload.put("body", resolvedBody);
        if (url != null && !url.isBlank()) {
            dataPayload.put("url", url);
        }
        payload.put("data", dataPayload);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Erreur de serialization push", e);
        }
    }

    private void sendToSubscriptions(List<NotificationSubscription> subs, String jsonPayload) {
        for (NotificationSubscription sub : subs) {
            sendNotification(sub, jsonPayload);
        }
    }

    private void sendNotification(NotificationSubscription sub, String payload) {
        try {
            Notification notification = new Notification(
                    sub.getEndpoint(),
                    sub.getP256dh(),
                    sub.getAuth(),
                    payload
            );
            if (pushService != null) {
                HttpResponse response = pushService.send(notification);
                int status = response.getStatusLine().getStatusCode();
                LOGGER.info("Push send status {} for {}", status, sub.getEndpoint());
                if (status >= 400) {
                    String responseBody = null;
                    try {
                        if (response.getEntity() != null) {
                            responseBody = EntityUtils.toString(response.getEntity());
                        }
                    } catch (Exception e) {
                        responseBody = "failed to read response body";
                    }
                    LOGGER.warn("Push send error body: {}", responseBody);
                }
                if (status == 404 || status == 410) {
                    subscriptionRepository.delete(sub);
                }
            }
        } catch (GeneralSecurityException | java.io.IOException | JoseException | ExecutionException e) {
            LOGGER.error("Push send failed", e);
            throw new RuntimeException("Erreur push", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error("Push send interrupted", e);
            throw new RuntimeException("Erreur push", e);
        }
    }
}
