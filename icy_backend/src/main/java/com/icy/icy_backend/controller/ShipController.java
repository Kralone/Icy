package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.response.BrandImageResponse;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.Brand;
import com.icy.icy_backend.service.ShipService;
import com.icy.icy_backend.service.BrandService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ships")
public class ShipController {
    private final ShipService shipService;
    private final BrandService brandService;

    public ShipController(ShipService shipService, BrandService brandService) {
        this.shipService = shipService;
        this.brandService = brandService;
    }

    @GetMapping
    public ResponseEntity<MessageResponse<List<Ship>>> getAllShips() {
        return shipService.getAllShips();
    }

    @GetMapping("/brands")
    public ResponseEntity<MessageResponse<List<String>>> getAllBrands() {
        return brandService.getAllBrands();
    }

    @GetMapping("/brands/images")
    public ResponseEntity<MessageResponse<List<BrandImageResponse>>> getAllBrandsWithImages() {
        return brandService.getAllBrandsWithImages();
    }

    @GetMapping("/shipsByBrand")
    public ResponseEntity<MessageResponse<List<Ship>>> getShipsByBrand(@RequestParam String brand) {
        return shipService.getShipsByBrand(brand);
    }
}
