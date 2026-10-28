package com.nbh.erp.customer.repository;

import com.nbh.erp.customer.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends com.nbh.erp.common.repository.RecyclableRepository<Customer> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Customer e where e.id = :id and e.deletedAt is null")
    java.util.Optional<Customer> findAnyByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    default Optional<Customer> findByIdForUpdate(Long id) {
        return findAnyByIdForUpdate(id).map(customer -> {
            requireActive(customer);
            return customer;
        });
    }

    Optional<Customer> findByIdAndIsActiveTrue(Long id);

    default List<Customer> requireActiveCustomers(List<Long> ids) {
        List<Customer> customers = findAllById(ids);
        if (customers.size() != new java.util.HashSet<>(ids).size()) {
            throw new com.nbh.erp.common.exception.BusinessException("Unknown customer in assignment");
        }
        customers.forEach(CustomerRepository::requireActive);
        return customers;
    }

    static void requireActive(Customer customer) {
        if (customer != null && !Boolean.TRUE.equals(customer.getIsActive())) {
            throw new com.nbh.erp.common.exception.BusinessException("Customer is inactive");
        }
    }

    @Query("SELECT DISTINCT c FROM Customer c LEFT JOIN c.customerGroups g LEFT JOIN c.customerGroup primaryGroup WHERE c.isActive = true AND c.deletedAt IS NULL AND ((g.isActive = true AND g.assignedStaff.id = :staffId) OR (primaryGroup.isActive = true AND primaryGroup.assignedStaff.id = :staffId)) AND NOT EXISTS (SELECT other.id FROM Customer owner JOIN owner.customerGroups other WHERE owner.id=c.id AND other.assignedStaff IS NOT NULL AND other.assignedStaff.id<>:staffId) AND (primaryGroup.assignedStaff IS NULL OR primaryGroup.assignedStaff.id=:staffId)")
    List<Customer> findAssignedPosCustomers(@Param("staffId") Long staffId);

    @Query("SELECT DISTINCT c FROM Customer c LEFT JOIN c.customerGroups g LEFT JOIN c.customerGroup primaryGroup WHERE c.isActive = true AND c.deletedAt IS NULL AND c.deliveryRoute.id = :routeId AND ((g.isActive = true AND g.assignedStaff.id = :staffId) OR (primaryGroup.isActive = true AND primaryGroup.assignedStaff.id = :staffId)) AND NOT EXISTS (SELECT other.id FROM Customer owner JOIN owner.customerGroups other WHERE owner.id=c.id AND other.assignedStaff IS NOT NULL AND other.assignedStaff.id<>:staffId) AND (primaryGroup.assignedStaff IS NULL OR primaryGroup.assignedStaff.id=:staffId)")
    List<Customer> findAssignedPosCustomersByRoute(@Param("staffId") Long staffId, @Param("routeId") Long routeId);

    @Query("SELECT CASE WHEN COUNT(DISTINCT c.id) > 0 THEN true ELSE false END FROM Customer c LEFT JOIN c.customerGroups g LEFT JOIN c.customerGroup primaryGroup WHERE c.id = :customerId AND c.isActive = true AND c.deletedAt IS NULL AND ((g.isActive = true AND g.assignedStaff.id = :staffId) OR (primaryGroup.isActive = true AND primaryGroup.assignedStaff.id = :staffId)) AND NOT EXISTS (SELECT other.id FROM Customer owner JOIN owner.customerGroups other WHERE owner.id=c.id AND other.assignedStaff IS NOT NULL AND other.assignedStaff.id<>:staffId) AND (primaryGroup.assignedStaff IS NULL OR primaryGroup.assignedStaff.id=:staffId)")
    boolean isAssignedPosCustomer(@Param("customerId") Long customerId,@Param("staffId") Long staffId);

    @Query("SELECT CASE WHEN COUNT(DISTINCT c.id) > 0 THEN true ELSE false END FROM Customer c LEFT JOIN c.customerGroups g LEFT JOIN c.customerGroup primaryGroup WHERE c.id = :customerId AND c.deliveryRoute.id = :routeId AND c.isActive = true AND c.deletedAt IS NULL AND ((g.isActive = true AND g.assignedStaff.id = :staffId) OR (primaryGroup.isActive = true AND primaryGroup.assignedStaff.id = :staffId)) AND NOT EXISTS (SELECT other.id FROM Customer owner JOIN owner.customerGroups other WHERE owner.id=c.id AND other.assignedStaff IS NOT NULL AND other.assignedStaff.id<>:staffId) AND (primaryGroup.assignedStaff IS NULL OR primaryGroup.assignedStaff.id=:staffId)")
    boolean isAssignedPosCustomerForRoute(@Param("customerId") Long customerId, @Param("staffId") Long staffId, @Param("routeId") Long routeId);

    Optional<Customer> findByCustomerCode(String customerCode);
    boolean existsByCustomerCode(String customerCode);
    List<Customer> findByIsActiveTrue();
    long countByIsActiveTrue();

    @Query("SELECT DISTINCT c FROM Customer c LEFT JOIN c.customerGroups g WHERE c.isActive = true AND (g.id = :customerGroupId OR c.customerGroup.id = :customerGroupId)")
    List<Customer> findByCustomerGroupId(@Param("customerGroupId") Long customerGroupId);

    @Query("SELECT DISTINCT c FROM Customer c LEFT JOIN c.customerGroups g WHERE c.deletedAt IS NULL AND (g.id = :groupId OR c.customerGroup.id = :groupId)")
    List<Customer> findAllGroupMembers(@Param("groupId") Long groupId);

    @Query("SELECT DISTINCT g.assignedStaff.id FROM Customer c JOIN c.customerGroups g WHERE c.id=:customerId AND g.assignedStaff IS NOT NULL AND (:excludedGroup IS NULL OR g.id<>:excludedGroup)")
    List<Long> findMappedStaffIds(@Param("customerId") Long customerId,@Param("excludedGroup") Long excludedGroup);

    @Query("SELECT c.customerGroup.assignedStaff.id FROM Customer c WHERE c.id=:customerId AND c.customerGroup.assignedStaff IS NOT NULL AND (:excludedGroup IS NULL OR c.customerGroup.id<>:excludedGroup)")
    List<Long> findPrimaryStaffIds(@Param("customerId") Long customerId,@Param("excludedGroup") Long excludedGroup);

    List<Customer> findByDeliveryRouteIdAndIsActiveTrue(Long deliveryRouteId);

    default List<Customer> findByDeliveryRouteId(Long deliveryRouteId) {
        return findByDeliveryRouteIdAndIsActiveTrue(deliveryRouteId);
    }

    default List<Customer> findByRouteId(Long routeId) {
        return findByCustomerGroupId(routeId);
    }

    @Query("SELECT c FROM Customer c WHERE c.isActive = true AND (LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(c.customerCode) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR c.phone LIKE CONCAT('%', :query, '%'))")
    List<Customer> searchCustomers(@Param("query") String query);
}
