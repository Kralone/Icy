package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.collection.CollectionController;
import com.icy.icy_backend.controller.dto.collection.TemplateCreateDTO;
import com.icy.icy_backend.controller.dto.collection.TemplateDetailDTO;
import com.icy.icy_backend.controller.dto.collection.TemplateListItemDTO;
import com.icy.icy_backend.controller.dto.collection.UserCollectionDetailDTO;
import com.icy.icy_backend.controller.dto.collection.UserCollectionListItemDTO;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.collection.CollectionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CollectionController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class CollectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CollectionService collectionService;

    @Test
    void collectionEndpointsReturnOk() throws Exception {
        when(collectionService.getTemplates(eq(null), eq(null))).thenReturn(List.of(new TemplateListItemDTO()));
        when(collectionService.getTemplate(eq(1L))).thenReturn(new TemplateDetailDTO());
        when(collectionService.updateTemplateByName(eq("name"), any(TemplateCreateDTO.class)))
                .thenReturn(new TemplateDetailDTO());
        when(collectionService.importTemplate(any(), eq(1L), eq("My"))).thenReturn(new UserCollectionDetailDTO());
        when(collectionService.getUserCollections(any())).thenReturn(List.of(new UserCollectionListItemDTO()));
        when(collectionService.getUserCollection(any(), eq(2L))).thenReturn(new UserCollectionDetailDTO());
        when(collectionService.patchCell(any(), eq(2L), eq("1"), eq("2"), eq(true)))
                .thenReturn(List.of("1"));
        when(collectionService.createTemplate(any(TemplateCreateDTO.class))).thenReturn(new TemplateDetailDTO());

        UUID userId = UUID.randomUUID();

        mockMvc.perform(get("/api/collections/templates"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/collections/templates/1"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/collections/templates/name")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new TemplateCreateDTO())))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/collections/import")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("templateId", 1, "name", "My"))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/collections/me")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/collections/me/2")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/collections/me/2/cell")
                        .with(TestAuth.user(userId, "USER"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("x", "1", "y", "2", "checked", true))))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/collections/me/2")
                        .with(TestAuth.user(userId, "USER")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/collections/templates")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new TemplateCreateDTO())))
                .andExpect(status().isOk());
    }
}




