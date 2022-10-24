package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundeRepository;
import org.springframework.stereotype.Service;
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
    public List<Kunde> findAllKundenWithKlasse(String stringFilter) {
        if (stringFilter == null || stringFilter.isEmpty()) {
            return kundeRepository.findAll();
        } else {
            return kundeRepository.searchKlasse(stringFilter);
        }
    }

    public long countKunde() {
        return kundeRepository.count();
    }

    public void deleteKunde(Kunde kunde) {
        kundeRepository.delete(kunde);
    }

    public void saveKunde(Kunde kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        kundeRepository.save(kunde);
    }
}
