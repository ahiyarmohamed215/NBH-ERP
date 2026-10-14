package com.nbh.erp.common.entity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@MappedSuperclass @Getter @Setter
public abstract class RecyclableEntity extends BaseEntity {
    private LocalDateTime deletedAt;
    private LocalDateTime purgedAt;
    @Column(length=20) private String statusBeforeDelete;
    private Boolean activeBeforeDelete;
    public abstract Long getId();
    public abstract Boolean getIsActive();
    public abstract void setIsActive(Boolean active);
    public boolean isDeleted() { return deletedAt != null; }
    public void requireNotDeleted() { if(isDeleted()) throw new com.nbh.erp.common.exception.BusinessException("Restore this record from the recycle bin before changing it"); }
    @PreUpdate public void guardDeletedActivation() { if(isDeleted() && Boolean.TRUE.equals(getIsActive())) throw new com.nbh.erp.common.exception.BusinessException("Deleted records cannot be activated; use Restore in the recycle bin"); }
}
