package lukegoll.schulranzen.aachen.webservices.data.entity;

import javax.persistence.Entity;
import javax.validation.constraints.NotBlank;
@Entity
public class Product extends AbstractEntity {

    @NotBlank
    private String productName;

    @NotBlank
    private int productId;

    public Product(){

    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public int getProductId() {
        return productId;
    }

    public void setProductId(int productId) {
        this.productId = productId;
    }
}
