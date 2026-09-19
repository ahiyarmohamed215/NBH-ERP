package com.nbh.erp.user.repository;

import com.nbh.erp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    org.springframework.data.domain.Page<User> findByApprovalStatus(String approvalStatus, org.springframework.data.domain.Pageable pageable);
    long countByApprovalStatus(String approvalStatus);
}
