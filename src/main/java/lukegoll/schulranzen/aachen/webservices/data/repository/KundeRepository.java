package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface KundeRepository extends JpaRepository<Kunde, Long> {

    @Query("select c from Kunde c " +
            "where lower(c.vorname) like lower(concat('%', :searchTerm, '%')) " +
            "or lower(c.nachname) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.adresse) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.stadt) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.plz) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.mail) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.tel) like lower(concat('%', :searchTerm, '%'))" +
            "or lower(c.product.productName) like lower(concat('%', :searchTerm, '%'))")
    List<Kunde> searchKeyword(@Param("searchTerm") String searchTerm);

    List<Kunde> findAllByKaufdatumBetween(
            LocalDate entryDate,
            LocalDate exitDate
    );

    List<Kunde> findAllByKaufdatumBefore(LocalDate localDate);

    List<Kunde> findAllByKaufdatumAfter(LocalDate localDate);
}
