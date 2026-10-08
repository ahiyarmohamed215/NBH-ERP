package com.nbh.erp.delivery.repository;

import com.nbh.erp.delivery.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Vehicle e where e.id = :id")
    java.util.Optional<Vehicle> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    Optional<Vehicle> findByVehicleNumber(String vehicleNumber);
    boolean existsByVehicleNumber(String vehicleNumber);
    List<Vehicle> findByIsActiveTrue();
    List<Vehicle> findByStatusAndIsActiveTrue(String status);
}
