package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Product;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import lukegoll.schulranzen.aachen.webservices.data.repository.ProductRepository;
import lukegoll.schulranzen.aachen.webservices.data.repository.ProviderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductDataService {
    private final ProductRepository productRepository;

    public ProductDataService(ProductRepository productRepository) {
        this.productRepository = productRepository;

    }

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    @Transactional
    public void deleteKunde(Product product) {
        productRepository.delete(product);
    }

    @Transactional
    public void saveProduct(Product product) {
        if (product == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        productRepository.save(product);
    }
}
