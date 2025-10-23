package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.IceLinkBlockDTO;
import com.icy.icy_backend.db.entity.IceLinkBlock;
import com.icy.icy_backend.db.repository.IceLinkBlockRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class IceLinkBlockService {

    private final IceLinkBlockRepository repository;
    private final IceLinkBlockGeneratorService generatorService;

    public IceLinkBlockDTO create(IceLinkBlockDTO dto) {
        if (repository.existsByNameIgnoreCase(dto.getName())) {
            log.warn("Tentative d’ajout d’un bloc déjà existant : {}", dto.getName());
            throw new ResourceAlreadyExistsException("Un bloc portant ce nom existe déjà.");
        }

        IceLinkBlock block = IceLinkBlock.builder()
                .name(dto.getName())
                .icon(dto.getIcon())
                .content(dto.getContent())
                .headline(dto.getHeadline())
                .description(dto.getDescription())
                .build();

        repository.save(block);
        log.info("Bloc IceLink créé : {}", dto.getName());
        return toDTO(block);
    }

    public IceLinkBlockDTO update(Long id, IceLinkBlockDTO dto) {
        IceLinkBlock block = repository.findById(id)
                .orElseThrow(() -> {
                    log.warn("Bloc non trouvé (update) : {}", id);
                    return new ResourceNotFoundException("Bloc non trouvé pour l’id " + id);
                });

        block.setName(dto.getName());
        block.setIcon(dto.getIcon());
        block.setContent(dto.getContent());
        block.setHeadline(dto.getHeadline());
        block.setDescription(dto.getDescription());

        repository.save(block);
        log.info("Bloc IceLink mis à jour : {}", block.getName());
        return toDTO(block);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            log.warn("Tentative de suppression d’un bloc inexistant : {}", id);
            throw new ResourceNotFoundException("Bloc non trouvé pour l’id " + id);
        }

        repository.deleteById(id);
        log.info("Bloc IceLink supprimé : {}", id);
    }

    public List<IceLinkBlockDTO> getAll() {
        List<IceLinkBlock> blocks = repository.findAllByOrderByNameAsc();

        return blocks.stream()
                .peek(block -> block.setContent(generatorService.generateDynamicContent(block)))
                .map(this::toDTO)
                .toList();
    }

    private IceLinkBlockDTO toDTO(IceLinkBlock block) {
        return IceLinkBlockDTO.builder()
                .id(block.getId())
                .name(block.getName())
                .icon(block.getIcon())
                .content(block.getContent())
                .headline(block.getHeadline())
                .description(block.getDescription())
                .build();
    }
}
