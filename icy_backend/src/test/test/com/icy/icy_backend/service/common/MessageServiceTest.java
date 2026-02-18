package com.icy.icy_backend.service.common;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.MessageSource;
import org.springframework.http.ResponseEntity;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

class MessageServiceTest {

    @Test
    void buildResponseUsesMessageSourceAndFormatsArgs() throws Exception {
        MessageSource messageSource = Mockito.mock(MessageSource.class);
        when(messageSource.getMessage(eq("demo.http"), isNull(), eq(Locale.getDefault()))).thenReturn("200");
        when(messageSource.getMessage(eq("demo.code"), isNull(), eq(Locale.getDefault()))).thenReturn("1000");
        when(messageSource.getMessage(eq("demo.title"), isNull(), eq(Locale.getDefault()))).thenReturn("Demo");
        when(messageSource.getMessage(eq("demo.message"), isNull(), eq(Locale.getDefault()))).thenReturn("Hello {0}");

        MessageService messageService = new MessageService(messageSource);
        ResponseEntity<MessageResponse<String>> response = messageService.buildResponse("demo", "payload", "Ice");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).isEqualTo("payload");
        var detailField = MessageResponse.class.getDeclaredField("messageDetail");
        detailField.setAccessible(true);
        Object detail = detailField.get(response.getBody());
        var detailMessageField = detail.getClass().getDeclaredField("message");
        detailMessageField.setAccessible(true);
        assertThat(detailMessageField.get(detail)).isEqualTo("Hello Ice");
        assertThat(response.getBody().getHttpCode()).isEqualTo(200);
        assertThat(response.getBody().getCode()).isEqualTo(1000);
    }
}
