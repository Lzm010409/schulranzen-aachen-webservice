package lukegoll.schulranzen.aachen.webservices.data;

import lukegoll.schulranzen.aachen.webservices.data.entity.MailTemplate;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import lukegoll.schulranzen.aachen.webservices.data.repository.MailTemplateRepository;
import lukegoll.schulranzen.aachen.webservices.data.repository.ProviderRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MailTemplateDataService {
    private final MailTemplateRepository mailTemplateRepository;

    public MailTemplateDataService(MailTemplateRepository mailTemplateRepository) {
        this.mailTemplateRepository = mailTemplateRepository;

    }

    public List<MailTemplate> findAll() {
        return mailTemplateRepository.findAll();
    }

    public void delete(MailTemplate provider) {
        mailTemplateRepository.delete(provider);
    }

    public void save(MailTemplate provider) {
        if (provider == null) {
            System.err.println("Contact is null. Are you sure you have connected your form to the application?");
            return;
        }
        mailTemplateRepository.save(provider);
    }
}
