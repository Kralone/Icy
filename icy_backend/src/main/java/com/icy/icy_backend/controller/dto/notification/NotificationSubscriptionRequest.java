package com.icy.icy_backend.controller.dto.notification;

import lombok.Data;

@Data
public class NotificationSubscriptionRequest {
    private String endpoint;
    private Keys keys;
    private String userAgent;

    @Data
    public static class Keys {
        private String p256dh;
        private String auth;
    }
}
