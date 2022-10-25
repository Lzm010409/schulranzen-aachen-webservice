package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailTextRepository extends JpaRepository<Kunde, Long> {
}
