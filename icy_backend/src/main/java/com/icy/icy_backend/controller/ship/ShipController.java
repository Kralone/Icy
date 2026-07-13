package com.icy.icy_backend.controller.ship;

import com.icy.icy_backend.controller.dto.response.image.BrandImageResponse;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.service.ship.ShipService;
import com.icy.icy_backend.service.brand.BrandService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    // === SHIPS ===
    @GetMapping
    public ResponseEntity<MessageResponse<List<Ship>>> getAllShips() {
        return shipService.getAllShips();
    }

    @GetMapping("/shipsByBrand")
    public ResponseEntity<MessageResponse<List<Ship>>> getShipsByBrand(@RequestParam String brand) {
        return shipService.getShipsByBrand(brand);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/create")
    public ResponseEntity<MessageResponse<Ship>> createShip(@RequestBody Ship ship) {
        return shipService.createShip(ship);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/update")
    public ResponseEntity<MessageResponse<Ship>> updateShip(
            @RequestParam Long id,
            @RequestBody Ship ship
    ) {
        return shipService.updateShip(id, ship);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping
    public ResponseEntity<MessageResponse<String>> deleteShip(@RequestParam Long id) {
        return shipService.deleteShip(id);
    }


    // === BRANDS ===
    @GetMapping("/brands")
    public ResponseEntity<MessageResponse<List<String>>> getAllBrands() {
        return brandService.getAllBrands();
    }

    @GetMapping("/brands/images")
    public ResponseEntity<MessageResponse<List<BrandImageResponse>>> getAllBrandsWithImages() {
        return brandService.getAllBrandsWithImages();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/brands/create")
    public ResponseEntity<MessageResponse<Brand>> createBrand(@RequestBody Brand brand) {
        return brandService.createBrand(brand);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/brands/update")
    public ResponseEntity<MessageResponse<Brand>> updateBrand(@RequestBody Brand brand) {
        return brandService.updateBrand(brand);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/brands/delete")
    public ResponseEntity<MessageResponse<String>> deleteBrand(@RequestParam String name) {
        return brandService.deleteBrand(name);
    }
}






