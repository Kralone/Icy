package com.icy.icy_backend.exception;

import com.icy.icy_backend.service.common.MessageService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerSecurityTest {

    @Test
    void doesNotWriteASecondSecurityResponseAfterCommit() throws Exception {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(mock(MessageService.class));
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.isCommitted()).thenReturn(true);

        handler.handleAccessDeniedException(response);

        verify(response, never()).sendError(403);
    }

    @Test
    void returnsForbiddenBeforeResponseIsCommitted() throws Exception {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(mock(MessageService.class));
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.isCommitted()).thenReturn(false);

        handler.handleAccessDeniedException(response);

        verify(response).sendError(403);
    }

    @Test
    void exposesBusinessStateErrorsAsBadRequestWithMessage() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(mock(MessageService.class));

        var response = handler.handleIllegalStateException(new IllegalStateException("Groupe complet"));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("Groupe complet", response.getBody().get("message"));
        assertEquals("Bad Request", response.getBody().get("error"));
    }
}
