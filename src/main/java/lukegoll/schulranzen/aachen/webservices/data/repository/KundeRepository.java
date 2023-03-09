package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KundeRepository extends JpaRepository<Kunde, Long> {

    @Query("select c from Kunde c " +
            "where lower(c.vorname) like lower(concat('%', :searchTerm, '%')) " +
            "or lower(c.nachname) like lower(concat('%', :searchTerm, '%'))")
    List<Kunde> searchName(@Param("searchTerm") String searchTerm);
    @Query("select c from Kunde c " +
            "where lower(c.jahr) like lower(concat('%', :searchTerm, '%')) ")
    List<Kunde> searchKlasse(@Param("searchTerm") String searchTerm);

}
