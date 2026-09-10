package com.icy.icy_backend.service.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import java.net.URI;
import java.util.List;

@Service
public class CatalogCorrectionService {
    private final JdbcTemplate jdbc;
    public CatalogCorrectionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public ImageCorrection image(long id) {
        return jdbc.query("SELECT id,name,source_image_url,image_override_url,image_url,image_is_fallback FROM catalog.entries WHERE id=?",
                (r,n) -> new ImageCorrection(r.getLong("id"),r.getString("name"),r.getString("source_image_url"),r.getString("image_override_url"),r.getString("image_url"),r.getBoolean("image_is_fallback")),id)
                .stream().findFirst().orElseThrow(() -> missing("Fiche introuvable"));
    }
    @Transactional
    public ImageCorrection saveImage(long id, String url) {
        String checked = validateImageUrl(url);
        if (jdbc.update("UPDATE catalog.entries SET image_override_url=?,image_url=?,image_is_fallback=FALSE WHERE id=?",checked,checked,id)==0) throw missing("Fiche introuvable");
        return image(id);
    }
    @Transactional
    public ImageCorrection resetImage(long id) {
        if (jdbc.update("UPDATE catalog.entries SET image_override_url=NULL,image_url=source_image_url,image_is_fallback=source_image_is_fallback WHERE id=?",id)==0) throw missing("Fiche introuvable");
        return image(id);
    }
    static String validateImageUrl(String value) {
        String url = value == null ? "" : value.trim();
        try {
            URI uri = URI.create(url);
            boolean local = !uri.isAbsolute() && uri.getRawAuthority()==null && (url.startsWith("/images/") || url.startsWith("/assets/")) && !url.contains("..");
            boolean remote = "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost()!=null && uri.getUserInfo()==null;
            if (url.length()>2048 || (!local && !remote) || uri.getFragment()!=null || url.contains("\\")) throw new IllegalArgumentException();
            return url;
        } catch (IllegalArgumentException exception) { throw new BadRequestException("Utilisez une URL HTTPS ou un chemin /images/ ou /assets/."); }
    }

    @Transactional(readOnly = true)
    public OfferPage offers(boolean corrected, String query, int page) {
        int safePage = Math.max(0, Math.min(page, 100000));
        String term = query == null ? "" : query.trim();
        String where = " FROM catalog.offers o LEFT JOIN catalog.entries e ON e.id=o.entry_id WHERE o.active AND "
                + (corrected ? "o.entry_override_id IS NOT NULL" : "(o.entry_id IS NULL OR e.active=FALSE)")
                + " AND (strpos(lower(o.entity_name),lower(?))>0 OR strpos(lower(o.location_name),lower(?))>0)";
        long total=jdbc.queryForObject("SELECT count(*)"+where,Long.class,term,term);
        List<Offer> rows=jdbc.query("SELECT o.id,o.entity_name,o.location_name,o.offer_type,o.price,o.currency,o.entry_override_id,e.name AS linked_name"+where+" ORDER BY lower(o.entity_name),o.id LIMIT 30 OFFSET ?",
                (r,n)->new Offer(r.getLong("id"),r.getString("entity_name"),r.getString("location_name"),r.getString("offer_type"),r.getBigDecimal("price"),r.getString("currency"),(Long)r.getObject("entry_override_id"),r.getString("linked_name")),term,term,safePage*30);
        return new OfferPage(rows,total,safePage);
    }
    @Transactional(readOnly = true)
    public List<Candidate> candidates(long offerId,String query) {
        OfferSource source=offerSource(offerId,false);
        String family=familyPredicate(source.vehicle());
        String term=query==null?"":query.trim();
        if (!term.isEmpty()) {
            if(term.length()<2) return List.of();
            return jdbc.query("SELECT id,name,family,image_url FROM catalog.entries WHERE active AND "+family+" AND strpos(lower(name),lower(?))>0 ORDER BY lower(name),id LIMIT 20",
                    (r,n)->new Candidate(r.getLong("id"),r.getString("name"),r.getString("family"),r.getString("image_url"),"Choix manuel"),term);
        }
        return jdbc.query("""
                SELECT id,name,family,image_url FROM catalog.entries WHERE active AND %s AND (
                 (external_id=? AND source='STAR_CITIZEN_WIKI') OR
                 regexp_replace(lower(name),'[^[:alnum:]]','','g')=regexp_replace(lower(?),'[^[:alnum:]]','','g') OR
                 (? AND manufacturer='Musashi Industrial and Starflight Concern' AND
                  regexp_replace(lower(name),'[^[:alnum:]]','','g')=regexp_replace(lower('MISC ' || ?),'[^[:alnum:]]','','g')))
                ORDER BY lower(name),id LIMIT 20
                """.formatted(family),
                (r,n)->new Candidate(r.getLong("id"),r.getString("name"),r.getString("family"),r.getString("image_url"),"Identifiant ou nom exact, préfixe MISC vérifié"),source.externalId(),source.name(),source.vehicle(),source.name());
    }
    @Transactional
    public void associate(long offerId,long entryId) {
        OfferSource source=offerSource(offerId,true);
        var valid=jdbc.queryForList("SELECT id FROM catalog.entries WHERE id=? AND active AND "+familyPredicate(source.vehicle())+" FOR SHARE",Long.class,entryId);
        if(valid.isEmpty()) throw new BadRequestException("La fiche doit être active et de même catégorie que l’offre.");
        jdbc.update("UPDATE catalog.offers SET entry_override_id=?,entry_id=? WHERE id=?",entryId,entryId,offerId);
    }
    @Transactional
    public void resetAssociation(long offerId) {
        offerSource(offerId,true);
        jdbc.update("UPDATE catalog.offers SET entry_override_id=NULL,entry_id=source_entry_id WHERE id=?",offerId);
    }
    private OfferSource offerSource(long id,boolean lock) {
        return jdbc.query("SELECT entity_external_id,entity_name,external_id FROM catalog.offers WHERE id=? AND active"+(lock?" FOR UPDATE":""),
                (r,n)->new OfferSource(r.getString("entity_external_id"),r.getString("entity_name"),r.getString("external_id").startsWith("vehicles_")),id)
                .stream().findFirst().orElseThrow(()->missing("Offre active introuvable"));
    }
    private static String familyPredicate(boolean vehicle) {
        return vehicle ? "family IN ('SHIP','GROUND_VEHICLE','POWER_SUIT')" : "family IN ('FPS_WEAPON','SHIP_WEAPON','ARMOR','SHIP_COMPONENT','MODULE','TOOL','ITEM')";
    }
    private static ResourceNotFoundException missing(String text) { return new ResourceNotFoundException(text); }
    private record OfferSource(String externalId,String name,boolean vehicle) {}
    public record ImageCorrection(long id,String name,String sourceImageUrl,String overrideImageUrl,String imageUrl,boolean fallbackImage) {}
    public record Offer(long id,String name,String location,String type,java.math.BigDecimal price,String currency,Long overrideEntryId,String linkedName) {}
    public record OfferPage(List<Offer> items,long totalElements,int page) {}
    public record Candidate(long id,String name,String family,String imageUrl,String reason) {}
}
