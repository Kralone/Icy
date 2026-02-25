package com.icy.icy_backend.controller.dto.notification;

import lombok.Data;

@Data
public class NotificationTestPushRequest {
    private String title;
    private String body;
    private String url;
    private Integer priority;
}
