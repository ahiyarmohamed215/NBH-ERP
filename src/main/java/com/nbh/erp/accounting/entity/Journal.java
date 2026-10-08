package com.nbh.erp.accounting.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.*;
@Entity @Getter @Setter @NoArgsConstructor
public class Journal extends com.nbh.erp.common.entity.BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,unique=true) private String source;
 @Column(nullable=false) private LocalDate postingDate;
 @Column(nullable=false) private String description;
 @Column(nullable=false) private String kind="GENERAL";
 private Long reversalOf;
 @Column(nullable=false) private boolean reversed;
 @Column(nullable=false) private boolean reconciled;
 @OneToMany(mappedBy="journal",cascade=CascadeType.ALL) private List<JournalLine> lines=new ArrayList<>();
}
