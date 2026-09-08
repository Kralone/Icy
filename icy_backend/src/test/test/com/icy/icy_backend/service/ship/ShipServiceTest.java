package com.icy.icy_backend.service.ship;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.db.repository.ship.ShipRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ShipServiceTest {

    @Test
    void createShipIsRejectedBecauseCatalogIsManagedAutomatically() {
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        ShipService service = new ShipService(shipRepository, brandRepository, messageService);

        Ship ship = new Ship();
        ship.setName("Gladius");

        assertThatThrownBy(() -> service.createShip(ship))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.GONE);
                    assertThat(exception.getReason()).contains("synchronisé automatiquement");
                });
        verifyNoInteractions(shipRepository, brandRepository, messageService);
    }

    @Test
    void getShipByNameThrowsWhenMissing() {
        ShipRepository shipRepository = Mockito.mock(ShipRepository.class);
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        ShipService service = new ShipService(shipRepository, brandRepository, messageService);
        when(shipRepository.findByName("Ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getShipByName("Ghost"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
