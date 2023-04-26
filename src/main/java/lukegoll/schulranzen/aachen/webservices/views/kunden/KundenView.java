package lukegoll.schulranzen.aachen.webservices.views.kunden;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.confirmdialog.ConfirmDialog;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.icon.VaadinIcon;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.component.textfield.TextField;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.ProductDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.list.InputForm;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;

import javax.annotation.security.PermitAll;
import java.util.ArrayList;
import java.util.List;

@PageTitle("Kunden")
@Route(value = "kunden", layout = MainLayout.class)
public class KundenView extends VerticalLayout {
    Grid<Kunde> grid = new Grid<>(Kunde.class);
    KundenDataService kundenDataService;

    ProductDataService productDataService;
    TextField filterText = new TextField();

    DatePicker firstDate = new DatePicker();
    DatePicker secondDate = new DatePicker();

    Button dateSearchButton = new Button(new Icon(VaadinIcon.SEARCH));
    Button resetFilterButton = new Button("Filter zurücksetzen");

    InputForm form;


    public KundenView(KundenDataService kundenDataService, ProductDataService productDataService) {
        this.productDataService = productDataService;
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
        grid.setColumns("kaufdatum", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.addColumn(Kunde::getProductName).setHeader("Produkt");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.asSingleSelect().addValueChangeListener(event -> editKunde(event.getValue()));
    }


    public void configureForm() {
        form = new InputForm(productDataService);
        form.setWidth("25em");
        form.addListener(InputForm.SaveEvent.class, this::saveKunde);
        form.addListener(InputForm.DeleteEvent.class, this::deleteKunde);
        form.addListener(InputForm.CloseEvent.class, event -> closeEditor());
    }

    public HorizontalLayout getToolbar() {
        filterText.setPlaceholder("Nach Personen filtern...");
        filterText.setVisible(true);
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        dateSearchButton.addClickListener(buttonClickEvent -> updateListWithSelectedDates()
        );
        resetFilterButton.addClickListener(buttonClickEvent -> resetFilter());
        firstDate.setPlaceholder("Von...");
        secondDate.setPlaceholder("Bis...");
        Button addKunde = new Button("Add Kunde");
        addKunde.addClickListener(event -> addKunde());
        addKunde.addThemeVariants(ButtonVariant.LUMO_PRIMARY);

        HorizontalLayout toolbar = new HorizontalLayout(filterText, firstDate, secondDate, dateSearchButton, resetFilterButton, addKunde);
        toolbar.addClassName("toolbar");
        return toolbar;
    }

    public void deleteKunde(InputForm.DeleteEvent event) {
        kundenDataService.deleteKunde(event.getKunde());
        updateList();
        closeEditor();
    }

    public void saveKunde(InputForm.SaveEvent event) {
        productDataService.saveProduct(event.getKunde().getProduct());
        kundenDataService.saveKunde(event.getKunde());
        updateList();
        closeEditor();
    }

    public void updateList() {
        grid.setItems(kundenDataService.findAllKundenWithName(filterText.getValue()));
    }

    public void resetFilter(){
        firstDate.setValue(null);
        secondDate.setValue(null);
        updateList();
    }

    public void updateListWithSelectedDates() {
        List<Kunde> kundenList = new ArrayList<>();
        if (firstDate.getValue() == null && secondDate.getValue() == null) {
            updateList();
        }
        if (firstDate.getValue() == null && secondDate.getValue() != null) {
            kundenList = kundenDataService.getKundeBeforeDate(secondDate.getValue());
        }
        if (firstDate.getValue() != null && secondDate.getValue() == null) {
            kundenList = kundenDataService.getKundenAfterDate(firstDate.getValue());
        }
        if (firstDate.getValue() != null && secondDate.getValue() != null) {
            kundenList = kundenDataService.getKundenBetweenDates(firstDate.getValue(), secondDate.getValue());
        }
        grid.setItems(kundenList);
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
