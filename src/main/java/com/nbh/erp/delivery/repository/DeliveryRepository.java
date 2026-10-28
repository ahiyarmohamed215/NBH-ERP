package com.nbh.erp.delivery.repository;

import com.nbh.erp.delivery.entity.Delivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRepository extends JpaRepository<Delivery, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Delivery e where e.id = :id")
    java.util.Optional<Delivery> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);


    @Query("select count(d) from Delivery d where d.status in ('SCHEDULED','IN_TRANSIT') and (d.driver.id = :staffId or d.assistantStaff.id = :staffId)")
    long activeTripsForStaff(@Param("staffId") Long staffId);

    Optional<Delivery> findByDeliveryNumber(String deliveryNumber);

    boolean existsByDeliveryNumber(String deliveryNumber);

    List<Delivery> findByStatus(String status);

    List<Delivery> findByScheduledDate(LocalDate scheduledDate);

    long countByStatus(String status);

    long countByScheduledDate(LocalDate scheduledDate);

    long countByStatusAndScheduledDate(String status, LocalDate scheduledDate);

    @Query("SELECT d FROM Delivery d " +
            "LEFT JOIN d.driver dr " +
            "LEFT JOIN d.assistantStaff asst " +
            "LEFT JOIN d.route r " +
            "WHERE " +
            "(:status IS NULL OR :status = '' OR d.status = :status) AND " +
            "(:routeId IS NULL OR (r IS NOT NULL AND r.id = :routeId)) AND " +
            "(:vehicleId IS NULL OR (d.vehicle IS NOT NULL AND d.vehicle.id = :vehicleId)) AND " +
            "(:startDate IS NULL OR d.scheduledDate >= :startDate) AND " +
            "(:endDate IS NULL OR d.scheduledDate <= :endDate) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(d.deliveryNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.vehicleNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "(dr IS NOT NULL AND (LOWER(dr.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(dr.username) LIKE LOWER(CONCAT('%', :search, '%')))) OR " +
            "(asst IS NOT NULL AND (LOWER(asst.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(asst.username) LIKE LOWER(CONCAT('%', :search, '%')))) OR " +
            "(r IS NOT NULL AND LOWER(r.routeName) LIKE LOWER(CONCAT('%', :search, '%')))) " +
            "ORDER BY d.createdAt DESC, d.id DESC")
    List<Delivery> searchDeliveries(
            @Param("status") String status,
            @Param("routeId") Long routeId,
            @Param("vehicleId") Long vehicleId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("search") String search
    );
}
