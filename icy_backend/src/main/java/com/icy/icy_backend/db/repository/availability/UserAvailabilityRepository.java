package com.icy.icy_backend.db.repository.availability;

import com.icy.icy_backend.db.entity.availability.UserAvailabilitySlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UserAvailabilityRepository extends JpaRepository<UserAvailabilitySlot, UserAvailabilitySlot.Key> {
    List<UserAvailabilitySlot> findByUserIdOrderByDayOfWeekAscPeriodAsc(UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM UserAvailabilitySlot s WHERE s.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
