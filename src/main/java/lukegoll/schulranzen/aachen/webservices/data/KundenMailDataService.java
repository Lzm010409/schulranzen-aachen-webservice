package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundenMailRepository;

import java.util.List;

public class KundenMailDataService {
    private final KundenMailRepository kundenMailRepository;

    public KundenMailDataService(KundenMailRepository kundenMailRepository) {
        this.kundenMailRepository = kundenMailRepository;

    }
    public List<Kunde> findAllKunden(String stringFilter) {
        return kundenMailRepository.findAll();
    }

    public void deleteKunde(Kunde kunde) {
        kundenMailRepository.delete(kunde);
    }

    public void saveKunde(Kunde kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        kundenMailRepository.save(kunde);
    }
}
