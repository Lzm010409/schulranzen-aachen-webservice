package lukegoll.schulranzen.aachen.webservices.views.mail;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.UI;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.checkbox.Checkbox;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.dialog.Dialog;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.icon.VaadinIcon;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.notification.NotificationVariant;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.progressbar.ProgressBar;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.PasswordField;
import com.vaadin.flow.component.textfield.TextArea;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.component.upload.Upload;
import com.vaadin.flow.component.upload.receivers.MultiFileMemoryBuffer;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.server.VaadinSession;
import lukegoll.mail.TextEncoder.HtmlEncoder;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.mail.send.MailSender;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.MailTemplateDataService;
import lukegoll.schulranzen.aachen.webservices.data.ProviderDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailTemplate;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.AsyncResult;
import org.springframework.util.concurrent.ListenableFuture;

import javax.mail.MessagingException;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@PageTitle("Mail")
@Route(value = "mail", layout = MainLayout.class)
public class MailView extends VerticalLayout {
    Grid<Kunde> grid = new Grid<>(Kunde.class);
    Grid<Kunde> grid2 = new Grid<>(Kunde.class);
    KundenDataService kundenDataService;
    ProviderDataService providerDataService;
    MailTemplateDataService mailTemplateDataService;
    Set<Kunde> kundenSet = new HashSet<>();

    Set<Kunde> kundenSet2 = new HashSet<>();

    Set<Kunde> selectedKunden = new HashSet<>();

    //    MailForm mailForm;
    DatePicker firstDate = new DatePicker();
    DatePicker secondDate = new DatePicker();
    TextField filterText = new TextField();
    EmailField emailField = new EmailField();
    PasswordField passwordField = new PasswordField();
    ComboBox<Provider> providerComboBox = new ComboBox<>();
    Button signIn = new Button("Anmelden");
    Button openMailDialog = new Button("Mail versenden!");
    Button dateSearchButton = new Button(new Icon(VaadinIcon.SEARCH));
    Button resetFilterButton = new Button("Filter zurücksetzen");

    Dialog mailDialog = new Dialog();
    List<Kunde> liste = new ArrayList<>();
    Login login = new Login();
    private Button manageTemplatesButton = new Button("Vorlagen verwalten", new Icon(VaadinIcon.FILE_TEXT));
    private ComboBox<MailTemplate> templateSelection = new ComboBox<>("Vorlage laden");
    TextField absender = new TextField("Absender");
    TextField betreff = new TextField("Betreff");
    TextArea mailText = new TextArea("Nachricht");
    Button sendButton = new Button("Versenden!");
    Button schließenButton = new Button("Abbrechen!");
    MultiFileMemoryBuffer multiFileMemoryBuffer = new MultiFileMemoryBuffer();
    Upload multiFileUpload = new Upload(multiFileMemoryBuffer);

    ProgressBar progressBar = new ProgressBar();


    private boolean sendVorgang = false;
    private double progress = 0;

    String userDataPath = "userData.txt";
    String providerDataPath = "providerData.txt";


    public void setSmtpPort(String smtpPort) {
        this.smtpPort = smtpPort;
    }

    private String smtpHost;
    private String smtpPort;


    UserData userData = new UserData();

    public MailView(KundenDataService kundenDataService, ProviderDataService providerDataService, MailTemplateDataService mailTemplateDataService) {
        this.providerDataService = providerDataService;
        this.kundenDataService = kundenDataService;
        this.mailTemplateDataService = mailTemplateDataService;

        addClassName("list-view");
        setSizeFull();

        // Initialisierung
        configureGrid();
        configureGridSelectedKunden();
        configureMailDialog();
        // Template Manager initialisieren (falls du die Methode aus dem vorherigen Schritt hast)
        // configureTemplateManager();

        configureToolbar();

        // --- NEU: Template Button initial unsichtbar ---
        manageTemplatesButton.setVisible(false);

        add(getContent());

        // --- NEU: Session Check am Ende des Konstruktors ---
        checkSessionAndRestore();
    }

    // Neue Methode zum Wiederherstellen der Session
    private void checkSessionAndRestore() {
        VaadinSession session = VaadinSession.getCurrent();
        javax.mail.Session existingSession = (javax.mail.Session) session.getAttribute("mailSession");
        UserData existingUser = (UserData) session.getAttribute("currentUserData");

        String savedHost = (String) session.getAttribute("smtpHost");
        String savedPort = (String) session.getAttribute("smtpPort");

        if (existingSession != null && existingUser != null && savedHost != null) {
            // 1. Login und UserData wiederherstellen
            this.login.setMailSession(existingSession);
            this.userData = existingUser;
            this.smtpHost = savedHost;
            this.smtpPort = savedPort;

            // 2. UI Kosmetik
            providerDataService.findAllKunden().stream()
                    .filter(p -> p.getSmtpHost().equals(savedHost))
                    .findFirst()
                    .ifPresent(provider -> providerComboBox.setValue(provider));

            this.emailField.setValue(existingUser.getUsername());

            System.out.println("Session wiederhergestellt.");

            // 3. UI freischalten
            unlockUI();

            // --- WICHTIG: Daten laden! ---
            // Dies sorgt dafür, dass die Tabelle direkt gefüllt wird
            updateList();
        }
    }


    public Component getContent() {
        openMailDialog.setVisible(false);

        // Logik für den Template Button
        manageTemplatesButton.addClickListener(e -> openTemplateManager());

        // Deine bestehenden Layouts
        filterText.addValueChangeListener(event -> updateList());
        HorizontalLayout horizontalLayout = new HorizontalLayout(filterText, firstDate, secondDate, dateSearchButton, resetFilterButton);

        // Buttons gruppieren
        HorizontalLayout actionButtons = new HorizontalLayout(openMailDialog, manageTemplatesButton);

        // In das Vertical Layout einfügen
        VerticalLayout content = new VerticalLayout(createMailLogin(), horizontalLayout, grid, grid2, actionButtons);

        return content;
    }

    public HorizontalLayout createMailLogin() {
        emailField.setPlaceholder("E-Mail Adresse");
        emailField.setErrorMessage("Das ist keine valide E-Mail");
        emailField.setClearButtonVisible(true);

        passwordField.setPlaceholder("Passwort");
        passwordField.setRevealButtonVisible(true);

        //passwordField.setHelperText("Das Passwort muss mit dem Mail-Account Passwort übereinstimmen, sonst können keine Mails versendet werden.");
        //signIn.addClickShortcut(Key.ENTER);
       /* if (parseData(userDataPath) != null) {
            String[] arr = parseData(userDataPath);
            userData.setUserMail(arr[0]);
            userData.setUsername(arr[0]);
            userData.setPassword(arr[1]);
            //mailForm.setUserData(this.userData);
            filterText.setVisible(true);
            grid.setVisible(true);
            grid2.setVisible(true);
            //mailForm.setVisible(true);
            emailField.setValue(userData.getUserMail());
            passwordField.setValue(userData.getPassword());
            if (parseData(providerDataPath) != null) {
                String[] providerArr = parseData(providerDataPath);
                if (providerArr.length > 0) {
                    if (providerDataService.findProvider(providerArr[0]).size() != 0) {
                        List<Provider> providers = providerDataService.findProvider(providerArr[0]);
                        providerComboBox.setItems(providerDataService.findAllKunden());
                        providerComboBox.setItemLabelGenerator(Provider::getProviderName);
                        providerComboBox.setValue(providers.get(0));
                        setSmtpHost(providerArr[0]);
                        setSmtpPort(providerArr[1]);
                    }
                }

            } else {
                providerComboBox.setItems(providerDataService.findAllKunden());
                providerComboBox.setItemLabelGenerator(Provider::getProviderName);
                providerComboBox.setPlaceholder("Bitte zu erst den Provider wählen!");
                Notification.show("Das lesen der Providerdaten aus dem Cache hat nicht funktioniert!" +
                        "Bitte noch einmal den Provider wählen!");
            }
        } else {
            signIn.addClickListener(buttonClickEvent -> loginIn(emailField.getValue(), passwordField.getValue()));
        }*/
        signIn.addClickListener(buttonClickEvent -> loginIn(emailField.getValue(), passwordField.getValue()));
        providerComboBox.setItems(providerDataService.findAllKunden());
        providerComboBox.setItemLabelGenerator(Provider::getProviderName);
        providerComboBox.setPlaceholder("Bitte zu erst den Provider wählen!");
        providerComboBox.addValueChangeListener(comboBoxProviderComponentValueChangeEvent -> setProviderData(providerComboBox.getValue()));
        HorizontalLayout mailLogin = new HorizontalLayout(providerComboBox, emailField, passwordField, signIn);
        return mailLogin;
    }


    private void unlockUI() {
        // 1. UI Elemente sichtbar schalten
        filterText.setVisible(true);
        grid.setVisible(true);
        grid2.setVisible(true);
        resetFilterButton.setVisible(true);
        dateSearchButton.setVisible(true);
        firstDate.setVisible(true);
        secondDate.setVisible(true);
        openMailDialog.setVisible(true);

        // 2. Button "Vorlagen verwalten" sichtbar machen (Dein Wunsch)
        manageTemplatesButton.setVisible(true);

        // 3. Login-Felder ausblenden (optional, aber user-freundlicher)
        // signIn.setEnabled(false);
        // oder die ganze Login-Leiste ausblenden, wenn du willst.

        showSuccesNot("Anmeldung aktiv.");
    }

    private void setProviderData(Provider value) {
        setSmtpHost(value.getSmtpHost());
        setSmtpPort(value.getSmtpPort());
        System.out.println("Smtp Host: " + smtpHost + "Smtp Port: " + smtpPort);
    }

    private void loginIn(String user, String password) {
        int exitcode = 0;
        try {
            exitcode = login.tryToAuthenticate(smtpHost, smtpPort, user, password);
            if (exitcode == 0) {
                userData.setUsername(user);
                userData.setPassword(password);

                // --- ÄNDERUNG: Speichere ALLES in die Session ---
                VaadinSession session = VaadinSession.getCurrent();
                session.setAttribute("mailSession", login.getMailSession());
                session.setAttribute("currentUserData", userData);

                // NEU: Host und Port speichern, damit sie nach Refresh da sind
                session.setAttribute("smtpHost", this.smtpHost);
                session.setAttribute("smtpPort", this.smtpPort);
                // ------------------------------------------------

                showSuccesNot("Erfolgreich authentifiziert!");
                unlockUI();
                updateList();
                // ... (Dein Datei-Writer Code bleibt hier) ...
            }
            // ... (Fehlerbehandlung bleibt hier) ...
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void configureGrid() {
        grid.addClassNames("contact-grid-mail");
        grid.setSizeFull();
        grid.setColumns("kaufdatum", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.addColumn(Kunde::getProductName).setHeader("Produkt");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.setHeight("500px");
        grid.setSelectionMode(Grid.SelectionMode.SINGLE);
        grid.setVisible(false);
        grid.addSelectionListener(selectionEvent -> uebertrageKundenData(selectionEvent.getFirstSelectedItem()));
        // grid.addSelectionListener(selectionEvent -> editMailForm(selectionEvent.getAllSelectedItems()));

    }

    public void configureMailDialog() {
        mailDialog.addClassName("mailDialog");
        mailDialog.setHeaderTitle("Mail versenden");

        // Bestehende Logik
        openMailDialog.addClickListener(buttonClickEvent -> {
            // Dropdown aktualisieren, falls zwischendurch neue Templates erstellt wurden
            templateSelection.setItems(mailTemplateDataService.findAll());
            mailDialog.open();
        });

        schließenButton.addClickListener(buttonClickEvent -> mailDialog.close());
        schließenButton.addThemeVariants(ButtonVariant.LUMO_ERROR);

        // Layout Anpassungen
        mailText.setMinHeight("400px");
        mailText.setMaxHeight("500px");
        mailText.setMinWidth("700px");
        absender.setMinWidth("500px");
        betreff.setMinWidth("500px");
        mailDialog.setMinWidth("800px");

        // --- NEU: Template Auswahl Logik ---
        templateSelection.setItemLabelGenerator(MailTemplate::getName);
        templateSelection.setPlaceholder("Vorlage auswählen...");
        templateSelection.setMinWidth("300px");
        templateSelection.setClearButtonVisible(true);

        templateSelection.addValueChangeListener(event -> {
            MailTemplate selected = event.getValue();
            if (selected != null) {
                // Wenn Template gewählt: Betreff übernehmen
                betreff.setValue(selected.getSubject());

                // Optional: Hinweis anzeigen, dass der Text im Editor in das Template eingebettet wird
                mailText.setLabel("Nachricht (wird in Template '" + selected.getName() + "' eingefügt)");
            } else {
                // Wenn Auswahl gelöscht:
                mailText.setLabel("Nachricht (wird als normaler Text gesendet)");
                // Betreff evtl. leeren oder lassen
            }
        });
        // -----------------------------------

        sendButton.addClickListener(buttonClickEvent -> {
            progressBar.setVisible(true);
            // ... (Dein bestehender Send-Code) ...
            UI ui = buttonClickEvent.getSource().getUI().orElseThrow();
            ListenableFuture<String> future = sendMail();
            future.addCallback(
                    successResult -> updateUi(successResult),
                    failureException -> showErrorNot(failureException.getMessage())
            );
        });

        HorizontalLayout buttonLayout = new HorizontalLayout(sendButton, schließenButton);

        // Layout neu zusammensetzen inklusive Template Selektor
        // Wir packen den Selektor ganz nach oben oder über den Betreff
        VerticalLayout verticalLayout = new VerticalLayout(
                templateSelection, // Neu hinzugefügt
                absender,
                betreff,
                mailText,
                multiFileUpload,
                buttonLayout
        );

        mailDialog.removeAll(); // Sicherstellen, dass wir nicht doppelt adden bei Re-Configure
        mailDialog.add(verticalLayout);
    }

    public void configureGridSelectedKunden() {
        grid2.addClassNames("contact-grid-mail");
        grid2.setSizeFull();
        grid2.setColumns("kaufdatum", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid2.addColumn(Kunde::getProductName).setHeader("Produkt");
        grid2.getColumns().forEach(col -> col.setAutoWidth(true));
        grid2.setVisible(false);
        grid2.addComponentColumn(person -> {
            Button editButton = new Button("Löschen");
            editButton.addClickListener(e -> {
                kundenSet.remove(person);
                grid2.setItems(kundenSet);
            });
            return editButton;


        });
        grid2.setHeight("500px");
    }

    public void configureToolbar() {
        filterText.setPlaceholder("Nach Keyword filtern...");
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        dateSearchButton.addClickListener(buttonClickEvent -> updateListWithSelectedDates());
        dateSearchButton.setVisible(false);
        resetFilterButton.addClickListener(buttonClickEvent -> resetFilter());
        resetFilterButton.setVisible(false);
        firstDate.setPlaceholder("Von...");
        firstDate.setVisible(false);
        secondDate.setPlaceholder("Bis...");
        secondDate.setVisible(false);

        filterText.setVisible(false);

    }


    private void uebertrageKundenData(Optional<Kunde> kunde) {
        if (kunde.isPresent()) {
            if (!kundenSet.contains(kunde.get())) {
                kundenSet.add(kunde.get());
            }
            grid2.setItems(kundenSet);
        }
        if (kundenSet.size() > 0) {
            grid2.setVisible(true);
        }

       /* if (this.kundenSet.size() < kundenSet.size()) {
            for (Kunde kunde : kundenSet) {
                if (!this.kundenSet.contains(kunde)) {
                    this.kundenSet.add(kunde);
                    continue;
                }
            }
            grid2.setItems(this.kundenSet);
            grid2.setVisible(true);
        } else {
            Set<Kunde> kundeSet = new HashSet<>();
            for (Kunde kunde : this.kundenSet) {
                if (!kundenSet.contains(kunde)) {
                    continue;
                }
                kundeSet.add(kunde);
            }
            this.kundenSet = kundeSet;
            grid2.setItems(this.kundenSet);
            grid2.setVisible(true);
        }*/
    }

    @Async
    public ListenableFuture<String> sendMail() {
        try {
            // ... dein bestehender Login Code ...
            login.login(smtpHost, smtpPort, userData.getUsername(), userData.getPassword());
            MailSender mailSender = new MailSender();
            mailSender.setMailSession(login.getMailSession());

            // --- NEUE LOGIK FÜR TEMPLATE ---
            String templateHtml = null;

            // Wir prüfen, ob ein Template ausgewählt ist
            MailTemplate selectedTemplate = templateSelection.getValue();
            if (selectedTemplate != null) {
                // Hier holen wir den HTML-Wrapper (Body) des Templates
                // Vorausgesetzt, dein MailTemplate Object hat eine getBody() Methode mit dem HTML Code
                templateHtml = selectedTemplate.getBody();
            }
            // -------------------------------

            int counter = 0;
            // Iteration über Kunden
            for (Kunde kunde : kundenSet) {
                // WICHTIG: Hier rufen wir jetzt die neue Methode auf
                // parameter: sender, senderName, empfänger, betreff, NACHRICHT (TextArea), TEMPLATE, attachments
                mailSender.sendMail(
                        userData.getUsername(),
                        absender.getValue(),
                        kunde.getMail(),
                        betreff.getValue(),
                        mailText.getValue(), // Das ist der Text, der in {Content} landet
                        templateHtml,        // Das ist das HTML Gerüst (oder null)
                        multiFileMemoryBuffer
                );
                counter++;
            }
            return AsyncResult.forValue("Versenden von: " + counter + " Mails erfolgreich.");
        } catch (Exception e) { // Exception Handling vereinfacht für Übersicht
            e.printStackTrace();
            return AsyncResult.forExecutionException(e);
        }
    }

    public void showErrorNot(String message) {
        Notification notification = new Notification();
        notification.addThemeVariants(NotificationVariant.LUMO_ERROR);

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


    private void updateUi(String message) {
        if (!message.equals("")) {
            mailDialog.close();
            multiFileMemoryBuffer = new MultiFileMemoryBuffer();
            multiFileUpload.clearFileList();
        }
        Notification.show(message);
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

    public String[] parseData(String path) {
        try {
            String userData = Files.readString(Path.of(path));
            String[] arr = userData.split("#");
            return arr;
        } catch (IOException e) {
            System.out.println("Datei konnte nicht gelesen werden.");
            return null;
        }


    }

    public void resetFilter() {
        firstDate.setValue(null);
        secondDate.setValue(null);
        updateList();
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

    private void openTemplateManager() {
        Dialog templateDialog = new Dialog();
        templateDialog.setHeaderTitle("E-Mail Vorlagen verwalten");
        templateDialog.setWidth("800px");
        templateDialog.setHeight("600px");

        // Formular Felder
        TextField tfName = new TextField("Vorlagen-Name (z.B. 'Rechnung')");
        TextField tfSubject = new TextField("Betreff");
        TextArea taBody = new TextArea("Nachrichtentext");
        Checkbox checkbox = new Checkbox("HTML Vorlage?");
        taBody.setHeight("200px");

        tfName.setWidthFull();
        tfSubject.setWidthFull();
        taBody.setWidthFull();
        checkbox.setWidthFull();

        // Grid zur Anzeige existierender Templates
        Grid<MailTemplate> templateGrid = new Grid<>(MailTemplate.class);

        // WICHTIG: Grid Columns definieren, damit nicht interne IDs etc. angezeigt werden
        // Wir nehmen 'name' und 'subject' als Standard, fügen 'html' custom hinzu
        templateGrid.setColumns("name", "subject");
        templateGrid.addColumn(template -> template.getHtml() ? "Ja" : "Nein").setHeader("HTML");

        templateGrid.setItems(mailTemplateDataService.findAll());
        templateGrid.setHeight("200px");

        // Buttons
        Button btnSave = new Button("Speichern", new Icon(VaadinIcon.DISC));
        btnSave.addThemeVariants(ButtonVariant.LUMO_PRIMARY);

        Button btnNew = new Button("Neu / Leeren", new Icon(VaadinIcon.PLUS));

        // --- NEU: Löschen Button ---
        Button btnDelete = new Button("Löschen", new Icon(VaadinIcon.TRASH));
        btnDelete.addThemeVariants(ButtonVariant.LUMO_ERROR);
        btnDelete.setEnabled(false); // Initial deaktiviert
        // ---------------------------

        Button btnClose = new Button("Schließen", e -> templateDialog.close());

        // Logik: Auswahl im Grid füllt das Formular
        templateGrid.asSingleSelect().addValueChangeListener(event -> {
            MailTemplate selected = event.getValue();
            if (selected != null) {
                tfName.setValue(selected.getName());
                tfSubject.setValue(selected.getSubject());
                taBody.setValue(selected.getBody());
                checkbox.setValue(selected.getHtml()); // Achte drauf: heißt der Getter getHtml() oder isHtml()?

                // Löschen aktivieren wenn ausgewählt
                btnDelete.setEnabled(true);
            } else {
                // Auswahl aufgehoben -> Button deaktivieren & Formular leeren
                btnDelete.setEnabled(false);
                tfName.clear();
                tfSubject.clear();
                taBody.clear();
                checkbox.setValue(false);
            }
        });

        // Speichern Logik
        btnSave.addClickListener(e -> {
            if (tfName.isEmpty() || tfSubject.isEmpty()) {
                Notification.show("Bitte Name und Betreff ausfüllen", 3000, Notification.Position.MIDDLE);
                return;
            }

            // HINWEIS: Hier wird aktuell immer ein NEUES Template erstellt.
            // Wenn du Bearbeiten willst, müsstest du prüfen, ob ein Template ausgewählt ist (via grid.asSingleSelect().getValue())
            // und dessen ID übernehmen.
            MailTemplate temp = new MailTemplate(tfName.getValue(), tfSubject.getValue(), taBody.getValue(), checkbox.getValue());

            MailTemplate selected = templateGrid.asSingleSelect().getValue();
            if (selected != null) {
                temp.setId(selected.getId()); // ID übernehmen für Update
            }


            mailTemplateDataService.save(temp);

            // Grid aktualisieren
            templateGrid.setItems(mailTemplateDataService.findAll());
            templateGrid.getDataProvider().refreshAll();

            // Formular zurücksetzen
            templateGrid.asSingleSelect().clear();

            Notification.show("Vorlage gespeichert");
        });

        // Neu Logik
        btnNew.addClickListener(e -> {
            templateGrid.asSingleSelect().clear(); // Deselektiert Grid -> löst Listener aus -> leert Felder & deaktiviert Löschen
            tfName.focus();
        });

        // --- NEU: Löschen Logik ---
        btnDelete.addClickListener(e -> {
            MailTemplate selected = templateGrid.asSingleSelect().getValue();
            if (selected != null) {
                // Löschen über den Service
                mailTemplateDataService.delete(selected);

                // UI Aktualisieren
                templateGrid.setItems(mailTemplateDataService.findAll());
                templateGrid.getDataProvider().refreshAll();
                templateGrid.asSingleSelect().clear(); // Auswahl aufheben

                Notification.show("Vorlage gelöscht", 3000, Notification.Position.BOTTOM_START);
            }
        });
        // --------------------------

        VerticalLayout formLayout = new VerticalLayout(tfName, tfSubject, taBody, checkbox);

        // Buttons gruppieren
        HorizontalLayout actions = new HorizontalLayout(btnNew, btnSave, btnDelete);

        VerticalLayout layout = new VerticalLayout(templateGrid, formLayout, actions, btnClose);
        templateDialog.add(layout);
        templateDialog.open();
    }

    private String stringToHtmlText(String text) {
        return HtmlEncoder.textToHTML(text);
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

    public UserData getUserData() {
        return userData;
    }

    public void setUserData(UserData userData) {
        this.userData = userData;
    }

    public String getSmtpHost() {
        return smtpHost;
    }

    public void setSmtpHost(String smtpHost) {
        this.smtpHost = smtpHost;
    }

    public String getSmtpPort() {
        return smtpPort;
    }


}

