package lukegoll.schulranzen.aachen.webservices.views.mail;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.KundenMailDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;
import lukegoll.schulranzen.aachen.webservices.list.InputForm;
import lukegoll.schulranzen.aachen.webservices.list.MailForm;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@PageTitle("Mail")
@Route(value = "mail", layout = MainLayout.class)
public class MailView extends VerticalLayout {
    Grid<Kunden> grid = new Grid<>(Kunden.class);
    Grid<Kunden> grid2 = new Grid<>(Kunden.class);
    KundenDataService kundenDataService;
    KundenMailDataService kundenMailDataService;

    MailForm mailForm;

    TextField filterText = new TextField();
    List<Kunden> liste = new ArrayList<>();

    public MailView(KundenDataService kundenDataService) {
        this.kundenDataService = kundenDataService;
        addClassName("list-view");
        setSizeFull();
        configureGrid();
        configureGridSelectedKunden();
        configureMailForm();
        add(getToolbarTop(), grid, getContent(), getToolbarBottom());
        updateList();

    }


    public Component getContent() {

        HorizontalLayout content = new HorizontalLayout(grid2, mailForm);
        content.setFlexGrow(2, grid2);
        content.setFlexGrow(1, mailForm);
        content.addClassName("content");
        content.setSizeFull();
        return content;
    }

    public void configureGrid() {
        grid.addClassNames("contact-grid-mail");
        grid.setSizeFull();
        grid.setColumns("klasse", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.setSelectionMode(Grid.SelectionMode.MULTI);
        grid.addSelectionListener(selectionEvent -> uebertrageKundenData(selectionEvent.getAllSelectedItems()));
    }

    public void configureGridSelectedKunden() {
        grid2.addClassNames("contact-grid-mail");
        grid2.setSizeFull();
        grid2.setColumns("klasse", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid2.getColumns().forEach(col -> col.setAutoWidth(true));
    }

    public HorizontalLayout getToolbarTop() {
        filterText.setPlaceholder("Nach Klasse filtern...");
        filterText.setVisible(true);
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        HorizontalLayout toolbar = new HorizontalLayout(filterText);
        toolbar.addClassName("toolbar");
        return toolbar;
    }

    public HorizontalLayout getToolbarBottom() {
        Button mail = new Button("Mails versenden");
        //mail.addClickListener(buttonClickEvent -> openMailForm());
        HorizontalLayout content = new HorizontalLayout(mail);
        return content;
    }
    public void configureMailForm() {
        mailForm = new MailForm();
        mailForm.setWidth("25em");
       // mailForm.addListener(MailForm.SaveEvent.class, this::saveKunde);
       // mailForm.addListener(InputForm.CloseEvent.class, event -> closeEditor());
    }
  /*  public void closeEditor() {
      //  mailForm.setKunde(null);
        mailForm.setVisible(false);
        removeClassName("editing");
    }*/

    private void openMailForm() {
        editMailForm();
    }

    private void editMailForm() {
        mailForm.setVisible(true);
    }

    private void uebertrageKundenData(Set<Kunden> kundenSet) {
        grid2.setItems(kundenSet);


    }

    public void updateList() {
        grid.setItems(kundenDataService.findAllKundenWithKlasse(filterText.getValue()));
    }

  /*  public void saveKunde(MailForm.SaveEvent event) {
        kundenDataService.saveKunde(event.getKunde());
        updateList();
    }*/

    public Grid<Kunden> getGrid() {
        return grid;
    }

    public void setGrid(Grid<Kunden> grid) {
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

}
