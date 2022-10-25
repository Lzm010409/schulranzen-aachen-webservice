package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.repository.MailTextRepository;

import java.util.List;

public class MailTextDataService {
    private final MailTextRepository mailTextRepository;

    public MailTextDataService(MailTextRepository kundenMailRepository) {
        this.mailTextRepository = kundenMailRepository;

    }
    public List<Kunde> findAllKunden(String stringFilter) {
        return mailTextRepository.findAll();
    }

    public void deleteKunde(Kunde kunde) {
        mailTextRepository.delete(kunde);
    }

    public void saveKunde(Kunde kunde) {
        if (kunde == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        mailTextRepository.save(kunde);
    }
}
