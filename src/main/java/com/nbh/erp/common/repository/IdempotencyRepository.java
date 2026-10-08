package com.nbh.erp.common.repository;
import com.nbh.erp.common.entity.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
public interface IdempotencyRepository extends JpaRepository<IdempotencyRecord,String> {}
