package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.ProviderDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProviderRepository extends JpaRepository<Provider, Long> {

    @Query("select c from Provider c " +
            "where lower(c.smtpHost) like lower(concat('%', :searchTerm, '%')) " +
            "or lower(c.smtpPort) like lower(concat('%', :searchTerm, '%'))")
    List<Provider> searchName(@Param("searchTerm") String searchTerm);
}
