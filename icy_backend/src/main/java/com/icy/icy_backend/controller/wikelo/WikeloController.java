package com.icy.icy_backend.controller.wikelo;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.service.wikelo.WikeloService;
import com.icy.icy_backend.service.wikelo.WikeloEquipmentCatalog;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/wikelo")
public class WikeloController {
    private final WikeloService wikeloService;
    private final WikeloEquipmentCatalog equipmentCatalog;

    public WikeloController(WikeloService wikeloService, WikeloEquipmentCatalog equipmentCatalog) {
        this.wikeloService = wikeloService;
        this.equipmentCatalog = equipmentCatalog;
    }

    @GetMapping("/ships")
    public ResponseEntity<MessageResponse<List<WikeloShip>>> getShips() {
        return wikeloService.getShips();
    }

    @GetMapping("/equipment")
    public EquipmentResponse getEquipment() {
        return new EquipmentResponse(equipmentCatalog.getEquipment());
    }

    public record EquipmentResponse(List<WikeloEquipmentCatalog.Equipment> data) {}
}
