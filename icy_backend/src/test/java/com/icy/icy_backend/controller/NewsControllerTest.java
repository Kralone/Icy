package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.news.NewsController;
import com.icy.icy_backend.controller.dto.news.NewsDTO;
import com.icy.icy_backend.controller.dto.news.NewsRequest;
import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.entity.news.NewsType;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.news.NewsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = NewsController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
class NewsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NewsService service;

    @Test
    void newsEndpointsReturnOk() throws Exception {
        when(service.getAll(eq(PageRequest.of(0, 10)))).thenReturn(new PageImpl<>(List.of(new NewsDTO())));
        when(service.create(any(News.class), eq(1L))).thenReturn(new News());
        when(service.update(eq(1L), any(News.class))).thenReturn(new NewsDTO());
        doNothing().when(service).delete(eq(1L));
        when(service.getAllTypes()).thenReturn(List.of(new NewsType()));
        when(service.createType(any(NewsType.class))).thenReturn(new NewsType());
        when(service.updateType(eq(1L), any(NewsType.class))).thenReturn(new NewsType());
        doNothing().when(service).deleteType(eq(1L));

        NewsRequest request = new NewsRequest();
        request.setTitle("title");
        request.setContent("content");
        request.setTypeId(1L);

        mockMvc.perform(get("/api/news")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/news")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/news/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/news/1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/news/types"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/news/types")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new NewsType())))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/news/types/1")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new NewsType())))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/news/types/1"))
                .andExpect(status().isOk());
    }
}
