package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.BrandImageResponse;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Brand;
import com.icy.icy_backend.db.repository.BrandRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.rest.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
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
        List<BrandImageResponse> brandResponses = brandRepository.findAll()
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
}
