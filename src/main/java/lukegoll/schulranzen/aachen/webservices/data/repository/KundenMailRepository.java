package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KundenMailRepository extends JpaRepository<Kunden, Long> {
}
