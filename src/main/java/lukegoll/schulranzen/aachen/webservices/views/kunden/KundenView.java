package lukegoll.schulranzen.aachen.webservices.views.kunden;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.button.Button;
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
        add(getToolbar(), getContent());
        updateList();
        closeEditor();

    }


    public Component getContent() {

        HorizontalLayout content = new HorizontalLayout(grid, form);
        content.setFlexGrow(2, grid);
        content.setFlexGrow(1, form);
        content.addClassName("content");
        content.setSizeFull();
        return content;
    }

    public void configureGrid() {
        grid.addClassNames("contact-grid");
        grid.setSizeFull();
        grid.setColumns("klasse", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.asSingleSelect().addValueChangeListener(event -> editKunde(event.getValue()));
    }


    public void configureForm() {
        form = new InputForm();
        form.setWidth("25em");
        form.addListener(InputForm.SaveEvent.class, this::saveKunde);
        form.addListener(InputForm.DeleteEvent.class, this::deleteKunde);
        form.addListener(InputForm.CloseEvent.class, event -> closeEditor());
    }

    public HorizontalLayout getToolbar() {
        filterText.setPlaceholder("Nach Namen filtern...");
        filterText.setVisible(true);
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());

        Button addKunde = new Button("Add Kunde");
        addKunde.addClickListener(event -> addKunde());

        HorizontalLayout toolbar = new HorizontalLayout(filterText, addKunde);
        toolbar.addClassName("toolbar");
        return toolbar;
    }

    public void deleteKunde(InputForm.DeleteEvent event) {
        kundenDataService.deleteKunde(event.getKunde());
        updateList();
        closeEditor();
    }

    public void saveKunde(InputForm.SaveEvent event) {
        kundenDataService.saveKunde(event.getKunde());
        updateList();
        closeEditor();
    }

    public void updateList() {
        grid.setItems(kundenDataService.findAllKundenWithName(filterText.getValue()));
    }


    public void closeEditor() {
        form.setKunde(null);
        form.setVisible(false);
        removeClassName("editing");
    }

    public void editKunde(Kunde kunde) {
        if (kunde == null) {
            closeEditor();
        } else {
            form.setKunde(kunde);
            form.setVisible(true);
            addClassName("editing");
        }
    }

    public void addKunde() {
        grid.asSingleSelect().clear();
        editKunde(new Kunde());
    }


    public Grid<Kunde> getGrid() {
        return grid;
    }

    public void setGrid(Grid<Kunde> grid) {
        this.grid = grid;
    }

    public KundenDataService getKundenDataService() {
        return kundenDataService;
    }

    public void setKundenDataService(KundenDataService kundenDataService) {
        this.kundenDataService = kundenDataService;
    }

    public TextField getFilterText() {
        return filterText;
    }

    public void setFilterText(TextField filterText) {
        this.filterText = filterText;
    }

    public InputForm getForm() {
        return form;
    }

    public void setForm(InputForm form) {
        this.form = form;
    }


}
