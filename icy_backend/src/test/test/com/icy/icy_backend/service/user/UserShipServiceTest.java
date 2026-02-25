package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.ship.ShipService;
import com.icy.icy_backend.websocket.ShipFleetWebSocketService;
import com.icy.icy_backend.websocket.UserWebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserShipServiceTest {

    @Test
    void getShipsByUserIdReturnsNotFoundWhenEmpty() {
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserService userService = Mockito.mock(UserService.class);
        ShipService shipService = Mockito.mock(ShipService.class);
        UserWebSocketService userWebSocketService = Mockito.mock(UserWebSocketService.class);
        ShipFleetWebSocketService shipFleetWebSocketService = Mockito.mock(ShipFleetWebSocketService.class);

        UserShipService service = new UserShipService(
                userShipRepository, messageService, userService, shipService, userWebSocketService, shipFleetWebSocketService
        );

        User user = new User();
        user.setId(UUID.randomUUID());
        when(userService.resolveUser(user.getId())).thenReturn(user);
        when(userShipRepository.findByUserId(user.getId())).thenReturn(List.of());

        ResponseEntity<MessageResponse<List<UserShip>>> response = okResponse(List.of());
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.notfound"), eq(List.of()), any());

        assertThat(service.getShipsByUserId(user.getId())).isEqualTo(response);
    }

    @Test
    void addShipToUserCreatesAndNotifies() {
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        UserService userService = Mockito.mock(UserService.class);
        ShipService shipService = Mockito.mock(ShipService.class);
        UserWebSocketService userWebSocketService = Mockito.mock(UserWebSocketService.class);
        ShipFleetWebSocketService shipFleetWebSocketService = Mockito.mock(ShipFleetWebSocketService.class);

        UserShipService service = new UserShipService(
                userShipRepository, messageService, userService, shipService, userWebSocketService, shipFleetWebSocketService
        );

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        Ship ship = new Ship();
        ship.setId(1L);
        ship.setName("Ship");

        when(userService.findUserById(userId)).thenReturn(user);
        when(shipService.findShipById(1L)).thenReturn(ship);
        when(userShipRepository.existsByUserIdAndShipId(userId, 1L)).thenReturn(false);
        when(userShipRepository.findAllWithShips()).thenReturn(List.of());

        ResponseEntity<MessageResponse<UserShip>> response = okResponse(new UserShip());
        Mockito.doReturn(response).when(messageService).buildResponse(eq("user.ship.add.success"), any());

        ResponseEntity<MessageResponse<UserShip>> actual = service.addShipToUser(userId, 1L, true, false, false);
        assertThat(actual).isEqualTo(response);
        verify(userWebSocketService).sendUserShipUpdate(any());
        verify(shipFleetWebSocketService).sendShipFleetUpdate(any());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
