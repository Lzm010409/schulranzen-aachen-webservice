package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundeRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class KundenDataService {
    private final KundeRepository kundeRepository;

    public KundenDataService(KundeRepository kundeRepository) {
        this.kundeRepository = kundeRepository;

    }

    public List<Kunden> findAllKundenWithName(String stringFilter) {
        if (stringFilter == null || stringFilter.isEmpty()) {
            return kundeRepository.findAll();
        } else {
            return kundeRepository.searchName(stringFilter);
        }
    }
    public List<Kunden> findAllKundenWithKlasse(String stringFilter) {
        if (stringFilter == null || stringFilter.isEmpty()) {
            return kundeRepository.findAll();
        } else {
            return kundeRepository.searchKlasse(stringFilter);
        }
    }

    public long countKunde() {
        return kundeRepository.count();
    }

    public void deleteKunde(Kunden kunde) {
        kundeRepository.delete(kunde);
    }

    public void saveKunde(Kunden kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        kundeRepository.save(kunde);
    }
}
