package lukegoll.schulranzen.aachen.webservices.views.kunden;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.component.textfield.TextField;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.list.InputForm;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;

import java.awt.*;

@PageTitle("Kunden")
@Route(value = "kunden", layout = MainLayout.class)
public class KundenView extends VerticalLayout {
    Grid<Kunde> grid = new Grid<>(Kunde.class);
    KundenDataService kundenDataService;
    TextField filterText = new TextField();
    InputForm form;

    public KundenView(KundenDataService kundenDataService) {
        this.kundenDataService = kundenDataService;
        addClassName("list-view");
        setSizeFull();
        configureGrid();
        configureForm();

        add(getContent());
        updateList();
    }



    private Component getContent() {

        HorizontalLayout content = new HorizontalLayout(grid, form);
        content.setFlexGrow(2, grid);
        content.setFlexGrow(1, form);
        content.addClassName("content");
        content.setSizeFull();
        return content;
    }

    private void configureGrid() {
        grid.addClassNames("contact-grid");
        grid.setSizeFull();
        grid.setColumns("id", "vorname", "nachname", "adresse", "plz", "stadt", "klasse", "mail", "tel");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
    }


    private void configureForm() {
        form = new InputForm();
        form.setWidth("25em");
    }

    private void updateList() {
        grid.setItems(kundenDataService.findAllKunden(filterText.getValue()));
    }


}
