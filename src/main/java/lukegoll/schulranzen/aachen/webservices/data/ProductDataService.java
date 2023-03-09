package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import lukegoll.schulranzen.aachen.webservices.data.repository.ProviderRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductDataService {
    private final ProviderRepository providerRepository;

    public ProductDataService(ProviderRepository providerRepository) {
        this.providerRepository = providerRepository;

    }

    public List<Provider> findAllKunden() {
        return providerRepository.findAll();
    }

    public void deleteKunde(Provider provider) {
        providerRepository.delete(provider);
    }

    public void saveKunde(Provider provider) {
        if (provider == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        providerRepository.save(provider);
    }
}
