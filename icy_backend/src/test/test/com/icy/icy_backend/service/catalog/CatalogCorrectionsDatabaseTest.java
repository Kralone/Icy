package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import com.icy.icy_backend.exception.definition.BadRequestException;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Run only on the explicitly supplied migrated validation database. Every change is rolled back. */
@EnabledIfEnvironmentVariable(named="CATALOG_TEST_JDBC_URL", matches=".+")
class CatalogCorrectionsDatabaseTest {
 Connection connection; JdbcTemplate jdbc; NamedParameterJdbcTemplate named; CatalogCorrectionService service; long run;
 ObjectMapper json=new ObjectMapper();
 @BeforeEach void setup() throws Exception {
  connection=DriverManager.getConnection(System.getenv("CATALOG_TEST_JDBC_URL"),System.getenv("CATALOG_TEST_DB_USER"),System.getenv("CATALOG_TEST_DB_PASSWORD"));
  connection.setAutoCommit(false);
  var ds=new SingleConnectionDataSource(connection,true); jdbc=new JdbcTemplate(ds); named=new NamedParameterJdbcTemplate(ds);service=new CatalogCorrectionService(jdbc);
  run=jdbc.queryForObject("INSERT INTO catalog.sync_runs(operation,status) VALUES('SCRAPE_AND_MAP','SUCCEEDED') RETURNING id",Long.class);
 }
 @AfterEach void cleanup() throws Exception { if(connection!=null){connection.rollback();connection.close();} }
 long entry(String external,String name,String family) {
  return jdbc.queryForObject("INSERT INTO catalog.entries(source,dataset_key,external_id,family,name,manufacturer,image_url,source_image_url,source_image_is_fallback,source_payload,last_seen_run_id) VALUES('STAR_CITIZEN_WIKI','items',?,?,?,'Test','/images/source.webp','/images/source.webp',FALSE,'{}',?) RETURNING id",Long.class,external,family,name,run);
 }
 @Test void imageOverrideSurvivesImportAndResetUsesLatestSource() throws Exception {
  long id=entry("correction-test-image","Correction Test Exact","ITEM");service.saveImage(id,"/images/corrected.webp");
  CatalogRawStore raw=mock(CatalogRawStore.class);
  when(raw.loadActive("STAR_CITIZEN_WIKI","items")).thenReturn(List.of(json.readTree("{\"uuid\":\"correction-test-image\",\"name\":\"Correction Test Exact\",\"images\":[{\"thumbnail_url\":\"/images/new-source.webp\"}]}")));
  new CatalogMapper(named,raw,json,mock(CatalogConflictService.class)).mapWikiDataset("items",run);
  assertThat(service.image(id).imageUrl()).isEqualTo("/images/corrected.webp");
  assertThat(service.image(id).sourceImageUrl()).isEqualTo("/images/new-source.webp");
  assertThat(service.resetImage(id).imageUrl()).isEqualTo("/images/new-source.webp");
 }
 @Test void explicitAssociationSurvivesEconomyImportAndResetRestoresSource() throws Exception {
  long original=entry("correction-source","Correction Source","ITEM"),manual=entry("correction-manual","Correction Manual","ITEM");
  var cache=mock(UexDatasetCacheRepository.class);
  for(String key:List.of("items_prices","vehicles_purchases_prices","vehicles_rentals_prices")) {
   var dataset=new UexDatasetCache();dataset.setDatasetKey(key);dataset.setPayload(json.readTree(key.equals("items_prices")?"[{\"id\":987654321,\"id_terminal\":987654321,\"item_uuid\":\"correction-source\",\"item_name\":\"Correction Source\",\"terminal_name\":\"Correction Test\",\"price_buy\":25}]":"[]"));when(cache.findById(key)).thenReturn(Optional.of(dataset));
  }
  var mapper=new CatalogEconomyMapper(cache,named,json);mapper.map(run);
  long offer=jdbc.queryForObject("SELECT id FROM catalog.offers WHERE external_id='items_prices:987654321:987654321:BUY' AND source='UEX'",Long.class);
  service.associate(offer,manual);mapper.map(run);
  assertThat(jdbc.queryForObject("SELECT entry_id FROM catalog.offers WHERE id=?",Long.class,offer)).isEqualTo(manual);
  assertThat(jdbc.queryForObject("SELECT source_entry_id FROM catalog.offers WHERE id=?",Long.class,offer)).isEqualTo(original);
  service.resetAssociation(offer);
  assertThat(jdbc.queryForObject("SELECT entry_id FROM catalog.offers WHERE id=?",Long.class,offer)).isEqualTo(original);
 }
 @Test void suggestionsPreserveVariantsAndNeverAssociateOnRead() {
  long exact=entry("correction-exact","Correction Rifle Red","FPS_WEAPON");entry("correction-variant","Correction Rifle Blue","FPS_WEAPON");
  long ship=entry("correction-ship","Correction Rifle Red","SHIP");
  long offer=jdbc.queryForObject("INSERT INTO catalog.offers(source,external_id,entity_name,offer_type,location_name,price,source_payload,last_seen_run_id) VALUES('UEX','items_prices:correction:1:BUY','Correction Rifle Red','BUY','Test',10,'{}',?) RETURNING id",Long.class,run);
  assertThat(service.candidates(offer,"")).extracting(CatalogCorrectionService.Candidate::id).containsExactly(exact);
  assertThat(jdbc.queryForObject("SELECT entry_id FROM catalog.offers WHERE id=?",Long.class,offer)).isNull();
  assertThatThrownBy(()->service.associate(offer,ship)).isInstanceOf(BadRequestException.class);
  service.associate(offer,exact);
  assertThat(jdbc.queryForObject("SELECT entry_id FROM catalog.offers WHERE id=?",Long.class,offer)).isEqualTo(exact);
 }
}
