package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundeRepository;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundenMailRepository;

import java.util.List;

public class KundenMailDataService {
    private final KundenMailRepository kundenMailRepository;

    public KundenMailDataService(KundenMailRepository kundenMailRepository) {
        this.kundenMailRepository = kundenMailRepository;

    }
    public List<Kunden> findAllKunden(String stringFilter) {
        return kundenMailRepository.findAll();
    }

    public void deleteKunde(Kunden kunde) {
        kundenMailRepository.delete(kunde);
    }

    public void saveKunde(Kunden kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        kundenMailRepository.save(kunde);
    }
}
