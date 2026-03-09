package lukegoll.schulranzen.aachen.webservices.views.kunden;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.html.Anchor;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.icon.VaadinIcon;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.notification.NotificationVariant;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.server.StreamResource;
import lukegoll.csv.CsvUtil;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.ProductDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.list.InputForm;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
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


    @Autowired
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
        filterText.setPlaceholder("Nach Keyword filtern...");
        filterText.setVisible(true);
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        dateSearchButton.addClickListener(buttonClickEvent -> updateListWithSelectedDates());
        resetFilterButton.addClickListener(buttonClickEvent -> resetFilter());
        firstDate.setPlaceholder("Von...");
        secondDate.setPlaceholder("Bis...");

        Button addKunde = new Button("Kunde hinzufügen");
        addKunde.addClickListener(event -> addKunde());
        addKunde.addThemeVariants(ButtonVariant.LUMO_PRIMARY);

        // --- NEUER DOWNLOAD-BUTTON ---
        Button exportKundenBtn = new Button("Kunden exportieren", new Icon(VaadinIcon.DOWNLOAD));
        exportKundenBtn.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        // StreamResource generiert die Datei "on the fly", wenn der Nutzer klickt
        StreamResource streamResource = new StreamResource("kunden_export.csv", () -> {
            try {
                // 1. Datei kurzzeitig im Temp-Verzeichnis des Servers erstellen
                String tempDir = System.getProperty("java.io.tmpdir");
                CsvUtil csvUtil = new CsvUtil(this.kundenDataService);
                File exportedFile = csvUtil.exportKundenAsFile(tempDir);

                // 2. Datei in den Arbeitsspeicher lesen, damit wir sie an den Browser senden können
                byte[] fileBytes = Files.readAllBytes(exportedFile.toPath());

                // 3. Temporäre Datei sofort wieder löschen, damit der Server nicht vollmüllt
                exportedFile.delete();

                return new ByteArrayInputStream(fileBytes);
            } catch (Exception e) {
                e.printStackTrace();
                // Fallback, falls etwas schiefgeht
                return new ByteArrayInputStream("Fehler beim Export".getBytes());
            }
        });

        // Vaadin benötigt einen Anchor (Link) für Downloads
        Anchor downloadAnchor = new Anchor(streamResource, "");
        downloadAnchor.getElement().setAttribute("download", true); // Erzwingt den Download im Browser
        downloadAnchor.add(exportKundenBtn); // Wir legen den Button in den Anchor
        // -----------------------------

        // WICHTIG: Füge hier nun 'downloadAnchor' zum Layout hinzu, nicht den Button selbst!
        HorizontalLayout toolbar = new HorizontalLayout(filterText, firstDate, secondDate, dateSearchButton, resetFilterButton, addKunde, downloadAnchor);
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
    public void resetFilter() {
        firstDate.setValue(null);
        secondDate.setValue(null);
        updateList();
    }
    public void updateList() {
        String filter = filterText.getValue();

        // Wenn NICHT gesucht wird -> Paging (Lazy Loading) aktivieren
        if (filter == null || filter.isEmpty()) {
            grid.setItems(query -> kundenDataService.fetchKundenPaging(query.getOffset(), query.getLimit()).stream());
        }
        // Wenn gesucht wird -> Paging DEAKTIVIEREN und alle Suchergebnisse laden
        else {
            grid.setItems(kundenDataService.findAllEntriesWithKeyword(filter));
        }
    }

    public void updateListWithSelectedDates() {
        if (firstDate.getValue() == null && secondDate.getValue() == null) {
            updateList(); // Springt zurück zur Standard-Logik (Paging)
            return;
        }

        // Sobald nach Datum gefiltert wird, deaktivieren wir das Paging
        List<Kunde> kundenList = new ArrayList<>();
        if (firstDate.getValue() == null && secondDate.getValue() != null) {
            kundenList = kundenDataService.getKundeBeforeDate(secondDate.getValue());
        } else if (firstDate.getValue() != null && secondDate.getValue() == null) {
            kundenList = kundenDataService.getKundenAfterDate(firstDate.getValue());
        } else if (firstDate.getValue() != null && secondDate.getValue() != null) {
            kundenList = kundenDataService.getKundenBetweenDates(firstDate.getValue(), secondDate.getValue());
        }

        grid.setItems(kundenList); // Setzt eine feste Liste im Speicher
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


    public void exportKunden(String path) {
        CsvUtil csvUtil1 = new CsvUtil(this.kundenDataService);
        File exportedFile = csvUtil1.exportKundenAsFile(path);
        showSuccesNot("Export unter: " + exportedFile.getAbsolutePath() + " gespeichert...");
    }

    public void showSuccesNot(String message) {
        Notification notification = new Notification();
        notification.addThemeVariants(NotificationVariant.LUMO_SUCCESS);

        Div text = new Div(new Text(message));

        Button closeButton = new Button(new Icon("lumo", "cross"));
        closeButton.addThemeVariants(ButtonVariant.LUMO_TERTIARY_INLINE);
        closeButton.getElement().setAttribute("aria-label", "Close");
        closeButton.addClickListener(event -> {
            notification.close();
        });

        HorizontalLayout layout = new HorizontalLayout(text, closeButton);
        layout.setAlignItems(Alignment.CENTER);

        notification.add(layout);
        notification.open();
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
