package com.nbh.erp.category.repository;

import com.nbh.erp.category.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends com.nbh.erp.common.repository.RecyclableRepository<Category> {
    Optional<Category> findByCode(String code);
    boolean existsByCode(String code);
    List<Category> findByIsActiveTrue();
}
