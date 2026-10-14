package com.nbh.erp.warehouse.repository;

import com.nbh.erp.warehouse.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WarehouseRepository extends com.nbh.erp.common.repository.RecyclableRepository<Warehouse> {
    Optional<Warehouse> findByCode(String code);
    boolean existsByCode(String code);
    List<Warehouse> findByIsActiveTrue();
}
