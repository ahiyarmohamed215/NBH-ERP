package com.nbh.erp.customer.repository;

import com.nbh.erp.customer.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Customer e where e.id = :id")
    java.util.Optional<Customer> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    Optional<Customer> findByCustomerCode(String customerCode);
    boolean existsByCustomerCode(String customerCode);
    List<Customer> findByIsActiveTrue();

    @Query("SELECT DISTINCT c FROM Customer c LEFT JOIN c.customerGroups g WHERE g.id = :customerGroupId OR c.customerGroup.id = :customerGroupId")
    List<Customer> findByCustomerGroupId(@Param("customerGroupId") Long customerGroupId);

    List<Customer> findByDeliveryRouteId(Long deliveryRouteId);

    default List<Customer> findByRouteId(Long routeId) {
        return findByCustomerGroupId(routeId);
    }

    @Query("SELECT c FROM Customer c WHERE c.isActive = true AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(c.customerCode) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR c.phone LIKE CONCAT('%', :query, '%'))")
    List<Customer> searchCustomers(@Param("query") String query);
}
