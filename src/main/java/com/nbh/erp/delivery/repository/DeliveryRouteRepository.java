package com.nbh.erp.delivery.repository;

import com.nbh.erp.delivery.entity.DeliveryRoute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRouteRepository extends JpaRepository<DeliveryRoute, Long> {
    Optional<DeliveryRoute> findByRouteCode(String routeCode);
    boolean existsByRouteCode(String routeCode);
    List<DeliveryRoute> findByIsActiveTrue();
}
