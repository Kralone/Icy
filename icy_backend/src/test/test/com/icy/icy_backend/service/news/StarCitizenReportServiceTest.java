package com.icy.icy_backend.service.news;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class StarCitizenReportServiceTest {

    @Test
    void extractReportTextParsesOutput() throws Exception {
        Method method = StarCitizenReportService.class.getDeclaredMethod("extractReportText", String.class);
        method.setAccessible(true);

        String json = """
                {
                  "output": [
                    {
                      "type": "message",
                      "content": [
                        { "type": "output_text", "text": "Hello" }
                      ]
                    }
                  ]
                }
                """;

        String text = (String) method.invoke(null, json);
        assertThat(text).isEqualTo("Hello");
    }
}
