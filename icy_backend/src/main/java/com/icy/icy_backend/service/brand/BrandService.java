package com.icy.icy_backend.service.brand;

import com.icy.icy_backend.controller.dto.response.image.BrandImageResponse;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class BrandService {
    private final BrandRepository brandRepository;
    private final MessageService messageService;

    public BrandService(BrandRepository brandRepository, MessageService messageService) {
        this.brandRepository = brandRepository;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<String>>> getAllBrands() {
        List<String> brands = brandRepository.findAll()
                .stream()
                .map(Brand::getName)
                .collect(Collectors.toList());
        return messageService.buildResponse("brand.found", brands);
    }

    public ResponseEntity<MessageResponse<List<BrandImageResponse>>> getAllBrandsWithImages() {
        List<BrandImageResponse> brandResponses = brandRepository.findAllByOrderByNameAsc()
                .stream()
                .map(brand -> {
                    BrandImageResponse response = new BrandImageResponse();
                    response.setName(brand.getName());
                    response.setImageUrl(brand.getImageUrl()); // Assurez-vous que la classe Brand a bien un champ imageUrl
                    return response;
                })
                .collect(Collectors.toList());

        return messageService.buildResponse("brand.found", brandResponses);
    }

    // === CREATE BRAND ===
    public ResponseEntity<MessageResponse<Brand>> createBrand(Brand brand) {
        log.info("Création d'une nouvelle marque: {}", brand.getName());

        if (brandRepository.existsByName(brand.getName())) {
            log.warn("La marque '{}' existe déjà.", brand.getName());
            throw new ResourceAlreadyExistsException("Cette marque existe déjà.");
        }

        Brand savedBrand = brandRepository.save(brand);
        return messageService.buildResponse("brand.created", savedBrand, savedBrand.getName());
    }

    // === UPDATE BRAND ===
    public ResponseEntity<MessageResponse<Brand>> updateBrand(Brand brand) {
        log.info("Mise à jour de la marque: {}", brand.getName());

        Brand existingBrand = brandRepository.findByName(brand.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Marque introuvable : " + brand.getName()));

        existingBrand.setImageUrl(brand.getImageUrl());
        Brand updated = brandRepository.save(existingBrand);

        return messageService.buildResponse("brand.updated", updated, updated.getName());
    }

    // === DELETE BRAND ===
    public ResponseEntity<MessageResponse<String>> deleteBrand(String name) {
        log.info("Suppression de la marque: {}", name);

        Brand existing = brandRepository.findByName(name)
                .orElseThrow(() -> new ResourceNotFoundException("Marque introuvable : " + name));

        brandRepository.delete(existing);
        return messageService.buildResponse("brand.deleted", "Marque supprimée avec succès.", name);
    }


}






