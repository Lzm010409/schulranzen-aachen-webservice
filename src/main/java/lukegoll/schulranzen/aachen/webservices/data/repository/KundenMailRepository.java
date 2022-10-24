package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailListe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KundenMailRepository extends JpaRepository<Kunde, Long> {
}
