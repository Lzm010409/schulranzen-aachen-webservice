package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProviderRepository extends JpaRepository<Provider, Long> {
}
