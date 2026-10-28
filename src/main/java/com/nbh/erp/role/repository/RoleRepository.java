package com.nbh.erp.role.repository;

import com.nbh.erp.role.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByName(String name);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from Role r where r.id = :id")
    Optional<Role> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
    List<Role> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String name, String description);
}

