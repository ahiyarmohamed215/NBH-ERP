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

    Optional<Delivery> findByDeliveryNumber(String deliveryNumber);

    boolean existsByDeliveryNumber(String deliveryNumber);

    List<Delivery> findByStatus(String status);

    List<Delivery> findByScheduledDate(LocalDate scheduledDate);

    long countByStatus(String status);

    long countByScheduledDate(LocalDate scheduledDate);

    long countByStatusAndScheduledDate(String status, LocalDate scheduledDate);

    @Query("SELECT d FROM Delivery d WHERE " +
            "(:status IS NULL OR :status = '' OR d.status = :status) AND " +
            "(:routeId IS NULL OR (d.route IS NOT NULL AND d.route.id = :routeId)) AND " +
            "(:vehicleId IS NULL OR (d.vehicle IS NOT NULL AND d.vehicle.id = :vehicleId)) AND " +
            "(:startDate IS NULL OR d.scheduledDate >= :startDate) AND " +
            "(:endDate IS NULL OR d.scheduledDate <= :endDate) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(d.deliveryNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.vehicleNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.driver.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.driver.username) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.assistantStaff.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(d.assistantStaff.username) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "(d.route IS NOT NULL AND LOWER(d.route.routeName) LIKE LOWER(CONCAT('%', :search, '%')))) " +
            "ORDER BY d.createdAt DESC")
    List<Delivery> searchDeliveries(
            @Param("status") String status,
            @Param("routeId") Long routeId,
            @Param("vehicleId") Long vehicleId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("search") String search
    );
}
