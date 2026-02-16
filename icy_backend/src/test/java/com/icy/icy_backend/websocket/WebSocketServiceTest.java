package com.icy.icy_backend.websocket;

import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

class WebSocketServiceTest {

    @Test
    void eventWebSocketSendsPayload() {
        SimpMessagingTemplate template = Mockito.mock(SimpMessagingTemplate.class);
        EventWebSocketService service = new EventWebSocketService(template);

        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setTitle("Event");
        event.setStartDateTime(LocalDateTime.now());
        event.setEndDateTime(LocalDateTime.now().plusHours(1));

        service.sendEventUpdate(event, "ADD");
        verify(template).convertAndSend(eq("/topic/events"), Mockito.any(Object.class));
    }

    @Test
    void notificationWebSocketSendsBroadcast() {
        SimpMessagingTemplate template = Mockito.mock(SimpMessagingTemplate.class);
        NotificationWebSocketService service = new NotificationWebSocketService(template);

        service.sendBroadcast("t", "b", "/u", 2);
        verify(template).convertAndSend(eq("/topic/notifications"), Mockito.any(Object.class));
    }

    @Test
    void userWebSocketSendsShipUpdate() {
        SimpMessagingTemplate template = Mockito.mock(SimpMessagingTemplate.class);
        UserWebSocketService service = new UserWebSocketService(template);

        User user = new User();
        user.setId(UUID.randomUUID());
        Ship ship = new Ship();
        ship.setId(1L);
        ship.setName("Ship");
        var brand = new com.icy.icy_backend.db.entity.brand.Brand();
        brand.setName("Brand");
        ship.setBrand(brand);
        UserShip userShip = new UserShip();
        userShip.setUser(user);
        userShip.setShip(ship);

        service.sendUserShipUpdate(userShip);
        verify(template).convertAndSend(eq("/topic/user/" + user.getId() + "/ships"), Mockito.any(Object.class));
    }

    @Test
    void fleetWebSocketSendsFleetUpdate() {
        SimpMessagingTemplate template = Mockito.mock(SimpMessagingTemplate.class);
        ShipFleetWebSocketService service = new ShipFleetWebSocketService(template);

        service.sendShipFleetUpdate(List.of(new FleetSummaryResponse("Ship", "img", "focus", null)));
        verify(template).convertAndSend(eq("/topic/fleet/update"), Mockito.any(Object.class));
    }

    @Test
    void goalWebSocketSendsGoalUpdate() {
        SimpMessagingTemplate template = Mockito.mock(SimpMessagingTemplate.class);
        GoalWebSocketService service = new GoalWebSocketService(template);

        service.sendGoalUpdate(1L, "UPDATE");
        verify(template).convertAndSend(eq("/topic/goals"), Mockito.any(Object.class));
    }
}
