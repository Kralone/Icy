package com.icy.icy_backend.service.scworldevent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventTypeDTO;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import com.icy.icy_backend.db.repository.scworldevent.ScWorldEventTypeRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ScWorldEventTypeServiceTest {

    @Test
    void createRejectsInvalidJson() {
        ScWorldEventTypeRepository repository = Mockito.mock(ScWorldEventTypeRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        ScWorldEventTypeService service = new ScWorldEventTypeService(repository, objectMapper);

        CreateScWorldEventTypeDTO dto = new CreateScWorldEventTypeDTO();
        dto.setName("Type");
        dto.setScoreSchema("{invalid}");

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createSavesType() {
        ScWorldEventTypeRepository repository = Mockito.mock(ScWorldEventTypeRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        ScWorldEventTypeService service = new ScWorldEventTypeService(repository, objectMapper);

        CreateScWorldEventTypeDTO dto = new CreateScWorldEventTypeDTO();
        dto.setName("Type");
        dto.setScoreSchema("{}");

        when(repository.save(any(ScWorldEventType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScWorldEventType saved = service.create(dto);
        assertThat(saved.getName()).isEqualTo("Type");
    }
}
