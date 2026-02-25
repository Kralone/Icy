package com.icy.icy_backend.db.repository.icelink;

import com.icy.icy_backend.db.entity.icelink.IceLinkBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IceLinkBlockRepository extends JpaRepository<IceLinkBlock, Long> {
    List<IceLinkBlock> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
}




