package com.icy.icy_backend.websocket;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Une écriture réussie sur SC World Events prévient les pages ouvertes ; une lecture ou un refus, jamais. */
class ScWorldEventLiveUpdateTest {

    @Test
    @SuppressWarnings("unchecked")
    void signalsOnlySuccessfulWrites() {
        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        ObjectProvider<SimpMessagingTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(template);
        ScWorldEventLiveUpdateInterceptor interceptor = new ScWorldEventLiveUpdateInterceptor(provider);

        interceptor.afterCompletion(new MockHttpServletRequest("GET", "/api/sc-world-events/current"), response(200), null, null);
        interceptor.afterCompletion(new MockHttpServletRequest("PUT", "/api/sc-world-events/x/participation/me"), response(403), null, null);
        interceptor.afterCompletion(new MockHttpServletRequest("PUT", "/api/sc-world-events/x/participation/me"), response(200), null, new IllegalStateException());
        verify(template, never()).convertAndSend(any(String.class), any(Object.class));

        interceptor.afterCompletion(new MockHttpServletRequest("PUT", "/api/sc-world-events/x/participation/me"), response(200), null, null);
        interceptor.afterCompletion(new MockHttpServletRequest("DELETE", "/api/sc-world-event-types/Xenothreat"), response(200), null, null);
        verify(template, times(2)).convertAndSend(eq("/topic/sc-world-events"), any(Object.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void staysSilentWithoutABroker() {
        ObjectProvider<SimpMessagingTemplate> provider = mock(ObjectProvider.class);
        new ScWorldEventLiveUpdateInterceptor(provider).afterCompletion(new MockHttpServletRequest("POST", "/api/sc-world-events"), response(200), null, null);
        verify(provider).getIfAvailable();
    }

    private static MockHttpServletResponse response(int status) {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(status);
        return response;
    }
}
