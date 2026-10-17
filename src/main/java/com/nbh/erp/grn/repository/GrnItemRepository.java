package com.nbh.erp.grn.repository;

import com.nbh.erp.grn.entity.GrnItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.util.List;

public interface GrnItemRepository extends JpaRepository<GrnItem,Long> {
    @Query("select i from GrnItem i join fetch i.grn g join fetch g.warehouse join fetch i.product p left join fetch i.warehouse " +
        "where g.status='PROCESSED' and p.id=:productId and coalesce(i.warehouse.id,g.warehouse.id)=:warehouseId " +
        "order by g.receivedDate desc,g.id desc,i.id desc")
    List<GrnItem> latestForProduct(@Param("warehouseId") Long warehouseId,@Param("productId") Long productId,Pageable pageable);

    @Query("select i from GrnItem i join fetch i.grn g join fetch g.warehouse join fetch i.product p left join fetch i.warehouse " +
        "where g.status='PROCESSED' and p.isActive=true and p.deletedAt is null and coalesce(i.warehouse.isActive,g.warehouse.isActive)=true " +
        "and (:query='' or lower(p.name) like lower(concat('%',:query,'%')) or lower(p.sku) like lower(concat('%',:query,'%'))) " +
        "and not exists (select n.id from GrnItem n where n.product=i.product and n.grn.status='PROCESSED' " +
        "and coalesce(n.warehouse.id,n.grn.warehouse.id)=coalesce(i.warehouse.id,g.warehouse.id) " +
        "and (n.grn.receivedDate>g.receivedDate or (n.grn.receivedDate=g.receivedDate and n.grn.id>g.id) " +
        "or (n.grn.id=g.id and n.id>i.id))) order by p.name,p.sku,g.id desc")
    List<GrnItem> searchAdjustmentProducts(@Param("query") String query,Pageable pageable);
}
