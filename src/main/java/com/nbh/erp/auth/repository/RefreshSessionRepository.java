package com.nbh.erp.auth.repository;
import com.nbh.erp.auth.entity.RefreshSession;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface RefreshSessionRepository extends JpaRepository<RefreshSession,String> {
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from RefreshSession s where s.id = :id")
 Optional<RefreshSession> lockById(String id);
}
