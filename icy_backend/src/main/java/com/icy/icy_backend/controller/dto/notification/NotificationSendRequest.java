package com.icy.icy_backend.controller.dto.notification;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class NotificationSendRequest {
    private String title;
    private String body;
    private String url;
    private Integer priority;
    private boolean broadcast;
    private List<UUID> userIds;
}
