package com.icy.icy_backend.service.brand;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.brand.Brand;
import com.icy.icy_backend.db.repository.brand.BrandRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class BrandServiceTest {

    @Test
    void getAllBrandsReturnsNames() {
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        BrandService brandService = new BrandService(brandRepository, messageService);

        Brand brand = new Brand();
        brand.setName("Aegis");
        when(brandRepository.findAll()).thenReturn(List.of(brand));

        ResponseEntity<MessageResponse<List<String>>> response = okResponse(List.of("Aegis"));
        when(messageService.buildResponse(eq("brand.found"), eq(List.of("Aegis")))).thenReturn(response);

        assertThat(brandService.getAllBrands()).isEqualTo(response);
    }

    @Test
    void createBrandThrowsWhenExists() {
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        BrandService brandService = new BrandService(brandRepository, messageService);

        Brand brand = new Brand();
        brand.setName("RSI");
        when(brandRepository.existsByName("RSI")).thenReturn(true);

        assertThatThrownBy(() -> brandService.createBrand(brand))
                .isInstanceOf(ResourceAlreadyExistsException.class);
    }

    @Test
    void updateBrandSavesExisting() {
        BrandRepository brandRepository = Mockito.mock(BrandRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        BrandService brandService = new BrandService(brandRepository, messageService);

        Brand existing = new Brand();
        existing.setName("RSI");
        existing.setImageUrl("old");
        when(brandRepository.findByName("RSI")).thenReturn(Optional.of(existing));

        Brand update = new Brand();
        update.setName("RSI");
        update.setImageUrl("new");

        Brand saved = new Brand();
        saved.setName("RSI");
        saved.setImageUrl("new");
        when(brandRepository.save(any(Brand.class))).thenReturn(saved);

        ResponseEntity<MessageResponse<Brand>> response = okResponse(saved);
        when(messageService.buildResponse(eq("brand.updated"), eq(saved), eq("RSI"))).thenReturn(response);

        assertThat(brandService.updateBrand(update)).isEqualTo(response);
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
