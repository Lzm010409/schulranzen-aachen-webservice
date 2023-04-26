package lukegoll.schulranzen.aachen.webservices.data.entity;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import java.util.Set;

@Entity
@Table(name = "product")
public class Product extends AbstractEntity {

    @NotBlank
    private String productName;

    @OneToMany (mappedBy = "product", fetch = FetchType.EAGER)
    private Set<Kunde> kunden;

    public Product(){

    }
    public Product(String productName) {
        this.productName = productName;
    }


    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

}
