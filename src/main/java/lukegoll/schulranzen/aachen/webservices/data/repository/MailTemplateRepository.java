package lukegoll.schulranzen.aachen.webservices.data.repository;

import lukegoll.schulranzen.aachen.webservices.data.entity.MailTemplate;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MailTemplateRepository extends JpaRepository<MailTemplate, Long> {

}
