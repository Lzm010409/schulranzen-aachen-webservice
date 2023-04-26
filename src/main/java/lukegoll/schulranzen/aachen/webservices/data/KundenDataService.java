package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class KundenDataService {
    private final KundeRepository kundeRepository;

    public KundenDataService(KundeRepository kundeRepository) {
        this.kundeRepository = kundeRepository;

    }

    public List<Kunde> findAllKundenWithName(String stringFilter) {
        if (stringFilter == null || stringFilter.isEmpty()) {
            return kundeRepository.findAll();
        } else {
            return kundeRepository.searchName(stringFilter);
        }
    }

    public List<Kunde> findAll() {
        return kundeRepository.findAll();
    }

    public long countKunde() {
        return kundeRepository.count();
    }

    @Transactional
    public void deleteKunde(Kunde kunde) {
        kundeRepository.delete(kunde);
    }

    @Transactional
    public void saveKunde(Kunde kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        kundeRepository.save(kunde);
    }

    public List<Kunde> getKundenBetweenDates(LocalDate firstDate, LocalDate secondDate) {
        return kundeRepository.findAllByKaufdatumBetween(firstDate, secondDate);
    }

    public List <Kunde> getKundeBeforeDate(LocalDate secondDate){
        return kundeRepository.findAllByKaufdatumBefore(secondDate);
    }
    public List <Kunde> getKundenAfterDate(LocalDate secondDate){
        return kundeRepository.findAllByKaufdatumAfter(secondDate);
    }
}
