package com.icy.icy_backend.service.icelink;

import com.icy.icy_backend.controller.dto.icelink.IceLinkBlockDTO;
import com.icy.icy_backend.db.entity.icelink.IceLinkBlock;
import com.icy.icy_backend.db.repository.icelink.IceLinkBlockRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class IceLinkBlockServiceTest {

    @Test
    void createRejectsDuplicateName() {
        IceLinkBlockRepository repository = Mockito.mock(IceLinkBlockRepository.class);
        IceLinkBlockGeneratorService generatorService = Mockito.mock(IceLinkBlockGeneratorService.class);
        IceLinkBlockService service = new IceLinkBlockService(repository, generatorService);

        IceLinkBlockDTO dto = IceLinkBlockDTO.builder().name("Block").build();
        when(repository.existsByNameIgnoreCase("Block")).thenReturn(true);

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(ResourceAlreadyExistsException.class);
    }

    @Test
    void getAllUsesGeneratedContent() {
        IceLinkBlockRepository repository = Mockito.mock(IceLinkBlockRepository.class);
        IceLinkBlockGeneratorService generatorService = Mockito.mock(IceLinkBlockGeneratorService.class);
        IceLinkBlockService service = new IceLinkBlockService(repository, generatorService);

        IceLinkBlock block = IceLinkBlock.builder().id(1L).name("events").content("old").build();
        when(repository.findAllByOrderByNameAsc()).thenReturn(List.of(block));
        when(generatorService.generateDynamicContent(block)).thenReturn("new");

        List<IceLinkBlockDTO> result = service.getAll();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getContent()).isEqualTo("new");
    }

    @Test
    void deleteRejectsMissing() {
        IceLinkBlockRepository repository = Mockito.mock(IceLinkBlockRepository.class);
        IceLinkBlockGeneratorService generatorService = Mockito.mock(IceLinkBlockGeneratorService.class);
        IceLinkBlockService service = new IceLinkBlockService(repository, generatorService);

        when(repository.existsById(1L)).thenReturn(false);
        assertThatThrownBy(() -> service.delete(1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
