package com.icy.icy_backend.websocket;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.*;

class OperationLiveUpdateTest {

    @Test
    void signalsTheOperationTopicWithItsIdentifierOnly() {
        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        UUID operationId = UUID.randomUUID();

        new OperationLiveUpdateService(template).changed(operationId);

        verify(template).convertAndSend(eq("/topic/operations/" + operationId),
                argThat((Object payload) -> payload instanceof Map<?, ?> map && map.keySet().equals(java.util.Set.of("operationId", "timestamp"))));
    }

    @Test
    void signalsOnlySuccessfulWritesOnAnOperation() {
        OperationLiveUpdateService service = mock(OperationLiveUpdateService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<OperationLiveUpdateService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(service);
        OperationLiveUpdateInterceptor interceptor = new OperationLiveUpdateInterceptor(provider);
        UUID operationId = UUID.randomUUID();

        interceptor.afterCompletion(request("POST", operationId.toString()), response(200), null, null);
        verify(service).changed(operationId);

        interceptor.afterCompletion(request("GET", operationId.toString()), response(200), null, null);
        interceptor.afterCompletion(request("PUT", operationId.toString()), response(409), null, null);
        interceptor.afterCompletion(request("DELETE", operationId.toString()), response(200), null, new IllegalStateException());
        interceptor.afterCompletion(request("POST", "create"), response(200), null, null);
        verifyNoMoreInteractions(service);
    }

    @Test
    void staysSilentWhenTheServiceIsAbsentFromAReducedContext() {
        @SuppressWarnings("unchecked")
        ObjectProvider<OperationLiveUpdateService> provider = mock(ObjectProvider.class);
        new OperationLiveUpdateInterceptor(provider).afterCompletion(request("POST", UUID.randomUUID().toString()), response(200), null, null);
        verify(provider).getIfAvailable();
    }

    private static MockHttpServletRequest request(String method, String id) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, "/api/operations/" + id + "/assignments/me");
        request.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("id", id));
        return request;
    }

    private static MockHttpServletResponse response(int status) {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(status);
        return response;
    }
}
