package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.user.UserShipController;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.user.UserShipService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserShipController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class UserShipControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserShipService userShipService;

    @MockBean
    private UserService userService;

    @Test
    void userShipEndpointsReturnOk() throws Exception {
        when(userShipService.getShipsByUserId(any(UUID.class))).thenReturn(okResponse(List.of(new UserShip())));
        when(userShipService.addShipToUser(any(UUID.class), eq(1L), eq(true), eq(false), eq(false))).thenReturn(okResponse(new UserShip()));
        when(userShipService.deleteShipFromUser(any(UUID.class), eq(1L))).thenReturn(okResponse(null));
        when(userShipService.deleteAllInGameAcquisitions()).thenReturn(okResponse(2));
        when(userShipService.getShipsByUserId(eq(123L))).thenReturn(okResponse(List.of(new UserShip())));
        when(userService.resolveUser(eq("123"))).thenReturn(new User());
        when(userShipService.addShipToUser(any(UUID.class), eq(2L), eq(true), eq(false), eq(false))).thenReturn(okResponse(new UserShip()));
        when(userShipService.deleteShipFromUser(eq(123L), eq(2L))).thenReturn(okResponse(null));
        when(userShipService.getFleetSummary()).thenReturn(okResponse(List.of(
                new FleetSummaryResponse("name", "image", "focus", "brand")
        )));

        UUID userId = UUID.randomUUID();
        mockMvc.perform(get("/api/user-ships")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/user-ships")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content("{\"shipId\":1,\"inGamePurchase\":true,\"rewardInGame\":false,\"loaner\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/user-ships")
                        .with(TestAuth.user(userId, "USER"))
                        .param("shipId", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/user-ships/admin/in-game-acquisitions")
                        .with(TestAuth.user(userId, "ADMIN")))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/user-ships/bot")
                        .param("discordId", "123"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/user-ships/bot")
                        .contentType("application/json")
                        .content("{\"discordId\":\"123\",\"shipId\":2,\"inGame\":true,\"rewardInGame\":false,\"loaner\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/user-ships/bot")
                        .param("discordId", "123")
                        .param("shipId", "2"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/user-ships/fleet-summary"))
                .andExpect(status().isOk());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




