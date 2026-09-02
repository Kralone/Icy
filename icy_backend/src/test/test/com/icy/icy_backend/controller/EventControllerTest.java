package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.event.EventController;
import com.icy.icy_backend.controller.dto.event.CreateEventRequest;
import com.icy.icy_backend.controller.dto.event.UpdateEventRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.EventParticipationResponseDTO;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.event.EventService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@WebMvcTest(controllers = EventController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class EventControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private EventService eventService;

    @Test
    void eventEndpointsReturnOk() throws Exception {
        when(eventService.createEvent(any(), any(), any(), any(), any()))
                .thenReturn(okResponse(new EventResponseDTO(new Event())));
        when(eventService.updateEvent(any(), any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(okResponse(new EventResponseDTO(new Event())));
        when(eventService.deleteEvent(any())).thenReturn(okResponse(null));
        when(eventService.getAllEvents()).thenReturn(okResponse(List.of(new EventResponseDTO(new Event()))));
        when(eventService.getAllEventsTypes()).thenReturn(okResponse(List.of(new EventType())));
        when(eventService.createEventType(any(), any(), any(), any())).thenReturn(okResponse(new EventType()));
        when(eventService.deleteEventType(eq("type"))).thenReturn(okResponse(null));
        when(eventService.setParticipation(any(), anyInt())).thenReturn(okResponse(null));
        Event participationEvent = new Event();
        participationEvent.setId(UUID.randomUUID());
        EventParticipation participation = new EventParticipation();
        participation.setId(UUID.randomUUID());
        participation.setEvent(participationEvent);
        User participant = new User();
        participant.setId(UUID.randomUUID());
        participant.setUsername("alice");
        participant.setDiscordId("123");
        participant.setPassword("must-not-leak");
        participant.setPwdReset(true);
        participation.setUser(participant);
        participation.setStatus(1);
        when(eventService.getEventParticipations(any()))
                .thenReturn(okResponse(List.of(new EventParticipationResponseDTO(participation))));
        when(eventService.getUpcomingEvents())
                .thenReturn(okResponse(List.of(new EventResponseDTO(new Event()))));
        when(eventService.updateEventType(eq("type"), any(EventType.class))).thenReturn(okResponse(new EventType()));

        CreateEventRequest createRequest = new CreateEventRequest();
        createRequest.setType("type");
        createRequest.setTitle("title");
        createRequest.setDescription("desc");
        createRequest.setStartDateTime(LocalDateTime.now());
        createRequest.setEndDateTime(LocalDateTime.now());

        UpdateEventRequest updateRequest = new UpdateEventRequest();
        updateRequest.setId(UUID.randomUUID());
        updateRequest.setType("type");
        updateRequest.setTitle("title");
        updateRequest.setDescription("desc");
        updateRequest.setStartDateTime(LocalDateTime.now());
        updateRequest.setEndDateTime(LocalDateTime.now());
        updateRequest.setFinished(false);

        mockMvc.perform(post("/api/events/create")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/events/update")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/events")
                        .param("id", UUID.randomUUID().toString()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/events/all"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/events/types"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/events/types")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new EventType())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/events/types/type"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/events/participation")
                        .contentType("application/json")
                        .content("{\"eventId\":\"" + UUID.randomUUID() + "\",\"status\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/events/participation")
                        .param("eventId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].user.username").value("alice"))
                .andExpect(jsonPath("$.data[0].user.discordId").doesNotExist())
                .andExpect(jsonPath("$.data[0].user.password").doesNotExist())
                .andExpect(jsonPath("$.data[0].user.pwdReset").doesNotExist())
                .andExpect(jsonPath("$.data[0].event.discordChannelId").doesNotExist());
        mockMvc.perform(get("/api/events/upcoming"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/events/types/type")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new EventType())))
                .andExpect(status().isOk());
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}




