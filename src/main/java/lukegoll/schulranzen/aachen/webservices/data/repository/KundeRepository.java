package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KundeRepository extends JpaRepository<Kunden, Long> {

    @Query("select c from Kunden c " +
            "where lower(c.vorname) like lower(concat('%', :searchTerm, '%')) " +
            "or lower(c.nachname) like lower(concat('%', :searchTerm, '%'))")
    List<Kunden> searchName(@Param("searchTerm") String searchTerm);
    @Query("select c from Kunden c " +
            "where lower(c.klasse) like lower(concat('%', :searchTerm, '%')) ")
    List<Kunden> searchKlasse(@Param("searchTerm") String searchTerm);

}
