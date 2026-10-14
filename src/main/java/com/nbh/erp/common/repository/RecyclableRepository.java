package com.nbh.erp.common.repository;
import com.nbh.erp.common.entity.RecyclableEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.domain.*;
import java.util.List;
@NoRepositoryBean
public interface RecyclableRepository<T extends RecyclableEntity> extends JpaRepository<T,Long> {
    @Override @Query("select e from #{#entityName} e where e.deletedAt is null") List<T> findAll();
    @Override @Query("select e from #{#entityName} e where e.deletedAt is null") List<T> findAll(Sort sort);
    @Override @Query("select e from #{#entityName} e where e.deletedAt is null") Page<T> findAll(Pageable pageable);
}
