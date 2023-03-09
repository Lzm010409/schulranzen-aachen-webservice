package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.spring.annotation.SpringComponent;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.repository.KundeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.data.domain.PageRequest;

@SpringComponent
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class KundenGrid extends Grid<Kunde> {

    public KundenGrid(@Autowired KundeRepository kundeRepository) {
        super(Kunde.class);
        setItems(q -> kundeRepository.findAll(PageRequest.of(q.getPage(), q.getPageSize())).stream());
        setColumns("id", "vorname", "nachname", "adresse", "stadt", "mail", "tel", "productName","productId");

    }
}
