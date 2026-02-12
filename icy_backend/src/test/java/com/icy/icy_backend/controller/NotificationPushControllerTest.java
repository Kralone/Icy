package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.notification.NotificationPushController;
import com.icy.icy_backend.controller.dto.notification.NotificationSendRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationSubscriptionRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationTestPushRequest;
import com.icy.icy_backend.controller.dto.notification.NotificationUnsubscribeRequest;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = NotificationPushController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
class NotificationPushControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NotificationPushService pushService;

    @Test
    void notificationPushEndpointsReturnOk() throws Exception {
        when(pushService.getPublicKey()).thenReturn("key");
        doNothing().when(pushService).subscribe(any(), any(NotificationSubscriptionRequest.class));
        doNothing().when(pushService).unsubscribe(any(), eq("endpoint"));
        doNothing().when(pushService).sendTest(any(), any(NotificationTestPushRequest.class));
        doNothing().when(pushService).sendBroadcast(any(), any(), any(), any());
        doNothing().when(pushService).sendToUsers(anyList(), any(), any(), any(), any());

        UUID userId = UUID.randomUUID();

        NotificationSubscriptionRequest subscription = new NotificationSubscriptionRequest();
        NotificationUnsubscribeRequest unsubscribe = new NotificationUnsubscribeRequest();
        unsubscribe.setEndpoint("endpoint");
        NotificationTestPushRequest testPush = new NotificationTestPushRequest();
        NotificationSendRequest send = new NotificationSendRequest();
        send.setTitle("title");
        send.setBody("body");
        send.setBroadcast(true);

        mockMvc.perform(get("/api/notifications/push/public-key"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/notifications/push/subscribe")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(subscription)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/notifications/push/subscribe")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(unsubscribe)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/notifications/push/test")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(testPush)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/notifications/push/send")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(send)))
                .andExpect(status().isOk());

        NotificationSendRequest targeted = new NotificationSendRequest();
        targeted.setTitle("title");
        targeted.setBody("body");
        targeted.setBroadcast(false);
        targeted.setUserIds(List.of(UUID.randomUUID()));

        mockMvc.perform(post("/api/notifications/push/send")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(targeted)))
                .andExpect(status().isOk());
    }
}
