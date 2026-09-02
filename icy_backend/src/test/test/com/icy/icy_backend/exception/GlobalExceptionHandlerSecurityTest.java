package com.icy.icy_backend.exception;

import com.icy.icy_backend.service.common.MessageService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
}
