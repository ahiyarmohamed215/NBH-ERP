package com.nbh.erp.salesman.repository;

import com.nbh.erp.salesman.entity.Salesman;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalesmanRepository extends JpaRepository<Salesman, Long> {
    Optional<Salesman> findBySalesmanCode(String salesmanCode);
    boolean existsBySalesmanCode(String salesmanCode);
    List<Salesman> findByIsActiveTrue();
}
