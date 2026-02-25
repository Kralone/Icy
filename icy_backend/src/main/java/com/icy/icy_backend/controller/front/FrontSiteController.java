package com.icy.icy_backend.controller.front;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.CelestialBodyDTO;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.controller.dto.response.front.OrbitalStationDTO;
import com.icy.icy_backend.controller.dto.response.front.UexRefineryDatasetsDTO;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.front.UexResourceSaleDTO;
import com.icy.icy_backend.controller.dto.response.user.UserOnlineResponseDTO;
import com.icy.icy_backend.db.entity.item.Item;
import com.icy.icy_backend.service.event.EventService;
import com.icy.icy_backend.service.item.ItemCatalogService;
import com.icy.icy_backend.service.universe.CelestialBodyService;
import com.icy.icy_backend.service.universe.OreLocationService;
import com.icy.icy_backend.service.universe.OrbitalStationService;
import com.icy.icy_backend.service.uex.UexDatasetService;
import com.icy.icy_backend.service.user.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/front")
public class FrontSiteController {

    private final UserService userService;
    private final EventService eventService;
    private final UexDatasetService uexDatasetService;
    private final CelestialBodyService celestialBodyService;
    private final OrbitalStationService orbitalStationService;
    private final OreLocationService oreLocationService;
    private final ItemCatalogService itemCatalogService;

    public FrontSiteController(
            UserService userService,
            EventService eventService,
            UexDatasetService uexDatasetService,
            CelestialBodyService celestialBodyService,
            OrbitalStationService orbitalStationService,
            OreLocationService oreLocationService,
            ItemCatalogService itemCatalogService
    ) {
        this.userService = userService;
        this.eventService = eventService;
        this.uexDatasetService = uexDatasetService;
        this.celestialBodyService = celestialBodyService;
        this.orbitalStationService = orbitalStationService;
        this.oreLocationService = oreLocationService;
        this.itemCatalogService = itemCatalogService;
    }

    @GetMapping("/members")
    public ResponseEntity<MessageResponse<List<UserOnlineResponseDTO>>> getFrontMembers() {
        return userService.getOnlineUsers();
    }

    @GetMapping("/recent-events")
    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> getRecentEvents() {
        return eventService.getRecentFinishedEvents();
    }

    @GetMapping("/resources/sales")
    public ResponseEntity<MessageResponse<List<UexResourceSaleDTO>>> listResourceSales(
            @RequestParam(value = "names", required = false) List<String> names
    ) {
        return uexDatasetService.listResourceSales(names);
    }

    @GetMapping("/resources/refineries")
    public ResponseEntity<MessageResponse<UexRefineryDatasetsDTO>> getRefineryDatasets() {
        return uexDatasetService.getRefineryDatasets();
    }

    @GetMapping("/celestial-bodies")
    public ResponseEntity<MessageResponse<List<CelestialBodyDTO>>> listCelestialBodies() {
        return celestialBodyService.listFrontBodies();
    }

    @GetMapping("/stations")
    public ResponseEntity<MessageResponse<List<OrbitalStationDTO>>> listStations() {
        return orbitalStationService.listFrontStations();
    }

    @GetMapping("/ore-locations")
    public ResponseEntity<MessageResponse<List<OreLocationDTO>>> listOreLocations() {
        return oreLocationService.listLocations();
    }

    @GetMapping("/items")
    public ResponseEntity<MessageResponse<List<Item>>> listItems() {
        return itemCatalogService.listItems();
    }
}
