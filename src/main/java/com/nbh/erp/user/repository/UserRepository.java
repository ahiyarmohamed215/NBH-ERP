package com.nbh.erp.user.repository;

import com.nbh.erp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends com.nbh.erp.common.repository.RecyclableRepository<User> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from User e where e.id = :id and e.deletedAt is null")
    java.util.Optional<User> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    java.util.List<User> findByIsActiveTrueAndApprovalStatusOrderByFullNameAsc(String approvalStatus);

    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByEmailIgnoreCase(String email);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM User u " +
            "LEFT JOIN FETCH u.roles r " +
            "LEFT JOIN FETCH r.permissions p " +
            "WHERE (u.username = :usernameOrEmail OR u.email = :usernameOrEmail) " +
            "AND u.deletedAt IS NULL")
    Optional<User> findByUsernameOrEmailWithRolesAndPermissions(@org.springframework.data.repository.query.Param("usernameOrEmail") String usernameOrEmail);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);
    org.springframework.data.domain.Page<User> findByApprovalStatusAndDeletedAtIsNull(String approvalStatus, org.springframework.data.domain.Pageable pageable);
    long countByApprovalStatusAndDeletedAtIsNull(String approvalStatus);
}
