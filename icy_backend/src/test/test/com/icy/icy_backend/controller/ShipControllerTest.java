package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.ship.ShipController;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.brand.BrandService;
import com.icy.icy_backend.service.ship.ShipService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ShipController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class ShipControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ShipService shipService;

    @MockBean
    private BrandService brandService;

    @Test
    void shipEndpointsReturnOk() throws Exception {
        when(shipService.getAllShips()).thenReturn(okResponse(List.of()));
        when(shipService.getShipsByBrand(eq("RSI"))).thenReturn(okResponse(List.of()));
        when(shipService.createShip(any(Ship.class))).thenReturn(okResponse(new Ship()));
        when(shipService.updateShip(eq(1L), any(Ship.class))).thenReturn(okResponse(new Ship()));
        when(shipService.deleteShip(eq(1L))).thenReturn(okResponse("ok"));
        when(brandService.getAllBrands()).thenReturn(okResponse(List.of()));
        when(brandService.getAllBrandsWithImages()).thenReturn(okResponse(List.of()));
        when(brandService.createBrand(any(Brand.class))).thenReturn(okResponse(new Brand()));
        when(brandService.updateBrand(any(Brand.class))).thenReturn(okResponse(new Brand()));
        when(brandService.deleteBrand(eq("RSI"))).thenReturn(okResponse("ok"));

        mockMvc.perform(get("/api/ships"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/ships/shipsByBrand")
                        .param("brand", "RSI"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/ships/create")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new Ship())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/ships/update")
                        .param("id", "1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new Ship())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/ships")
                        .param("id", "1"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/ships/brands"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/ships/brands/images"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/ships/brands/create")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new Brand())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/ships/brands/update")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new Brand())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/ships/brands/delete")
                        .param("name", "RSI"))
                .andExpect(status().isOk());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




