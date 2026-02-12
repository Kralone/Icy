package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.image.ImageController;
import com.icy.icy_backend.controller.image.dto.ImageUpdateRequest;
import com.icy.icy_backend.controller.support.TestAuth;
import com.icy.icy_backend.db.entity.image.ImageMetadata;
import com.icy.icy_backend.db.entity.image.ImageTag;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.exception.GlobalExceptionHandler;
import com.icy.icy_backend.security.JwtAuthenticationFilter;
import com.icy.icy_backend.security.SecurityConfig;
import com.icy.icy_backend.service.image.ImageService;
import com.icy.icy_backend.service.user.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ImageController.class, excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class}
))
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("removal")
class ImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ImageService imageService;

    @MockBean
    private UserService userService;

    @Test
    void imageEndpointsReturnOk() throws Exception {
        when(imageService.listAll()).thenReturn(List.of(new ImageMetadata()));
        when(imageService.listCategories()).thenReturn(List.of("cat"));
        doNothing().when(imageService).createCategory(eq("cat"));
        when(imageService.listSubcategories(eq("cat"))).thenReturn(List.of("sub"));
        doNothing().when(imageService).createSubcategory(eq("cat"), eq("sub"));
        when(imageService.listTags()).thenReturn(List.of(new ImageTag()));
        doNothing().when(imageService).upsertTagColors(anyMap());

        Resource resource = new ByteArrayResource("data".getBytes()) {
            @Override
            public String getFilename() {
                return "file.png";
            }
        };
        when(imageService.getImage(eq("file.png"))).thenReturn(resource);

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("user");
        when(userService.findUserById(eq(userId))).thenReturn(user);
        when(imageService.upload(any(), eq(userId), eq("user"), anyList(), any(), any(), anyMap()))
                .thenReturn(new ImageMetadata());
        doNothing().when(imageService).delete(eq("file.png"));
        when(imageService.updateMetadata(eq(UUID.fromString("00000000-0000-0000-0000-000000000001")), any(), any(), any(), anyMap()))
                .thenReturn(new ImageMetadata());

        mockMvc.perform(get("/api/images"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/images/categories"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/images/categories")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("name", "cat"))))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/images/categories/cat/subcategories"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/images/categories/cat/subcategories")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("name", "sub"))))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/images/tags"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/images/tags")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("tag", "#fff"))))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/images/file.png"))
                .andExpect(status().isOk());

        mockMvc.perform(multipart("/api/images/upload")
                        .file("file", "data".getBytes())
                        .with(TestAuth.user(userId, "ADMIN")))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/images/file.png")
                        .with(TestAuth.user(userId, "ADMIN")))
                .andExpect(status().isNoContent());

        ImageUpdateRequest updateRequest = new ImageUpdateRequest("cat", "sub", List.of("tag"), Map.of("tag", "#fff"));
        mockMvc.perform(patch("/api/images/00000000-0000-0000-0000-000000000001")
                        .with(TestAuth.user(userId, "ADMIN"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk());
    }
}




