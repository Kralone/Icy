package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.news.CigWatchController;
import com.icy.icy_backend.service.news.CigWatchPublicationService;
import com.icy.icy_backend.service.news.CigWatchService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CigWatchControllerTest {
    @Test void excludedSourceReturnsConflictWithAdminExplanation() throws Exception {
        var publication = mock(CigWatchPublicationService.class);
        var feed = mock(CigWatchService.class);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Veille uniquement"))
                .when(publication).requestAction(33L, false);
        var mvc = MockMvcBuilders.standaloneSetup(new CigWatchController(feed, publication)).build();
        mvc.perform(post("/api/news/cig/entries/33/retry"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Veille uniquement"));
        verifyNoInteractions(feed);
    }
}
