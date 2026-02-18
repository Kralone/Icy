package com.icy.icy_backend.service.ship;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class ShipServiceTest {

    @Test
    void createShipSavesWithBrand() {
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        ShipService service = new ShipService(shipRepository, brandRepository, messageService, notificationPushService);

        Brand brand = new Brand();
        brand.setName("Aegis");
        when(brandRepository.findByName("Aegis")).thenReturn(Optional.of(brand));

        Ship ship = new Ship();
        ship.setName("Gladius");
        ship.setBrand(brand);

        when(shipRepository.save(any(Ship.class))).thenReturn(ship);
        ResponseEntity<MessageResponse<Ship>> response = okResponse(ship);
        when(messageService.buildResponse(eq("ship.created"), eq(ship), eq("Gladius"))).thenReturn(response);

        assertThat(service.createShip(ship)).isEqualTo(response);
    }

    @Test
    void getShipByNameThrowsWhenMissing() {
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        ShipService service = new ShipService(shipRepository, brandRepository, messageService, notificationPushService);
        when(shipRepository.findByName("Ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getShipByName("Ghost"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
