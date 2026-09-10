package com.icy.icy_backend.service.catalog;
import org.junit.jupiter.api.Test;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.controller.admin.CatalogCorrectionController;
import org.springframework.security.access.prepost.PreAuthorize;
import static org.assertj.core.api.Assertions.*;
class CatalogCorrectionServiceTest {
 @Test void validatesImageUrlsWithoutFetchingThem() {
  assertThat(CatalogCorrectionService.validateImageUrl(" https://example.org/exact.webp ")).isEqualTo("https://example.org/exact.webp");
  assertThat(CatalogCorrectionService.validateImageUrl("/images/exact.webp")).isEqualTo("/images/exact.webp");
  for(String url:new String[]{"javascript:alert(1)","//other.example/image","data:image/svg+xml,test","http://example.org/a","https://user:secret@example.org/a","/images/../secret",""})
   assertThatThrownBy(()->CatalogCorrectionService.validateImageUrl(url)).isInstanceOf(BadRequestException.class);
 }
 @Test void restrictsEveryCorrectionEndpointToAdministrators() {
  assertThat(CatalogCorrectionController.class.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasRole('ADMIN')");
 }
}
