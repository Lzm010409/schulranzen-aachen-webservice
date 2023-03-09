package lukegoll.schulranzen.aachen.webservices.views.mail;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.UI;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.dialog.Dialog;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.notification.NotificationVariant;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.progressbar.ProgressBar;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.PasswordField;
import com.vaadin.flow.component.textfield.TextArea;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import lukegoll.mail.TextEncoder.HtmlEncoder;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.mail.send.MailSender;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.ProviderDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;
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
    Set<Kunde> kundenSet;

//    MailForm mailForm;

    TextField filterText = new TextField();
    EmailField emailField = new EmailField();
    PasswordField passwordField = new PasswordField();
    ComboBox<Provider> providerComboBox = new ComboBox<>();
    Button signIn = new Button("Anmelden");
    Button openMailDialog = new Button("Mail versenden!");
    Dialog mailDialog = new Dialog();
    List<Kunde> liste = new ArrayList<>();
    Login login = new Login();

    TextField absender = new TextField("Absender");
    TextField betreff = new TextField("Betreff");
    TextArea mailText = new TextArea("Nachricht");
    Button sendButton = new Button("Versenden!");
    Button schließenButton = new Button("Abbrechen!");

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

    public MailView(KundenDataService kundenDataService, ProviderDataService providerDataService) {
        this.providerDataService = providerDataService;
        this.kundenDataService = kundenDataService;
        progressBar.setVisible(false);
        addClassName("list-view");
        setSizeFull();
        configureGrid();
        configureGridSelectedKunden();
        // configureMailForm();
        configureMailDialog();
        configureToolbar();
        add(getContent());
        updateList();

    }


    public Component getContent() {
       /* HorizontalLayout content1 = new HorizontalLayout(grid2, mailForm);
        content1.setFlexGrow(2, grid2);
        content1.setFlexGrow(1, mailForm);
        content1.addClassName("content");
        content1.setSizeFull();
*/
        VerticalLayout content = new VerticalLayout(createMailLogin(), filterText, grid, grid2, openMailDialog);


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
        if (parseData(userDataPath) != null) {
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
        }
        providerComboBox.addValueChangeListener(comboBoxProviderComponentValueChangeEvent -> setProviderData(providerComboBox.getValue()));
        HorizontalLayout mailLogin = new HorizontalLayout(providerComboBox, emailField, passwordField, signIn);
        return mailLogin;
    }

    private void setProviderData(Provider value) {
        setSmtpHost(value.getSmtpHost());
        setSmtpPort(value.getSmtpPort());
        try {
            BufferedWriter writer = new BufferedWriter(new FileWriter(providerDataPath));
            writer.write(getSmtpHost() + "#");
            writer.write(getSmtpPort());
            writer.close();
        } catch (Exception e) {
            e.printStackTrace();

        }

        //    mailForm.setProvider(value);
        System.out.println("Smtp Host: " + smtpHost + "Smtp Port: " + smtpPort);
    }

    private void loginIn(String user, String password) {
        int exitcode = 0;
        try {
            exitcode = login.tryToAuthenticate(smtpHost, smtpPort, user, password);
            if (exitcode == 0) {
                userData.setUsername(user);
                userData.setPassword(password);
                //mailForm.setUserData(this.userData);
                showSuccesNot();
                filterText.setVisible(true);
                grid.setVisible(true);
                grid2.setVisible(true);
                //mailForm.setVisible(true);
                try {
                    BufferedWriter writer = new BufferedWriter(new FileWriter(userDataPath));
                    writer.write(user + "#");
                    writer.write(password);
                    writer.close();
                } catch (Exception e) {
                    e.printStackTrace();

                }

            }
            if (exitcode == 1) {
                showErrorNot();
                passwordField.clear();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }


    }

    public void configureGrid() {
        grid.addClassNames("contact-grid-mail");
        grid.setSizeFull();
        grid.setColumns("jahr", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.setHeight("100");
        grid.setSelectionMode(Grid.SelectionMode.MULTI);
        grid.setVisible(false);
        grid.addSelectionListener(selectionEvent -> uebertrageKundenData(selectionEvent.getAllSelectedItems()));
        // grid.addSelectionListener(selectionEvent -> editMailForm(selectionEvent.getAllSelectedItems()));

    }

    public void configureMailDialog() {
        mailDialog.addClassName("mailDialog");
        mailDialog.setHeaderTitle("Mail versenden");
        openMailDialog.addClickListener(buttonClickEvent -> mailDialog.open());
        schließenButton.addClickListener(buttonClickEvent -> mailDialog.close());
        schließenButton.addThemeVariants(ButtonVariant.LUMO_ERROR);
        mailText.setMinHeight("400px");
        mailText.setMaxHeight("500px");
        mailText.setMinWidth("700px");
        absender.setMinWidth("500px");
        betreff.setMinWidth("500px");

        mailDialog.setMinWidth("800px");

        sendButton.addClickListener(buttonClickEvent -> {
            progressBar.setVisible(true);
            UI ui = buttonClickEvent.getSource().getUI().orElseThrow();
            ListenableFuture<String> future = sendMail();
            future.addCallback(
                    successResult -> updateUi(ui, successResult),
                    failureException -> updateUi(ui, failureException.getMessage())
            );

        });
        HorizontalLayout buttonLayout = new HorizontalLayout(sendButton, schließenButton);
        VerticalLayout verticalLayout = new VerticalLayout(absender, betreff, mailText, buttonLayout);
        mailDialog.add(verticalLayout);
    }

    public void configureGridSelectedKunden() {
        grid2.addClassNames("contact-grid-mail");
        grid2.setSizeFull();
        grid2.setColumns("jahr", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid2.getColumns().forEach(col -> col.setAutoWidth(true));
        grid2.setVisible(false);

    }

    public void configureToolbar() {
        filterText.setPlaceholder("Nach Klasse filtern...");
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        filterText.setVisible(false);

    }


  /*  private void editMailForm(Set<Kunde> kundenSet) {
        if (kundenSet.isEmpty()) {
            closeEditor();
        } else {
            mailForm.setKundeSet(kundenSet);
            addClassName("editing");


        }
    }

    public void configureMailForm() {
        mailForm = new MailForm(userData);
        mailForm.setWidth("25em");
        mailForm.setVisible(false);
        // mailForm.addListener(MailForm.SendEvent.class, this::);
        // mailForm.addListener(InputForm.CloseEvent.class, event -> closeEditor());
    }

    public void closeEditor() {
        //mailForm.setMailAdress(null);
        mailForm.setVisible(false);
        removeClassName("editing");
    }*/

    private void updateUi(UI ui, String result) {
        if (result != "") {
            mailDialog.close();
        }
        ui.access(() -> {
            Notification.show(result);
            progressBar.setVisible(false);
        });
    }


    private void uebertrageKundenData(Set<Kunde> kundenSet) {
        if (kundenSet.isEmpty()) {
            grid2.setVisible(false);
        } else {
            grid2.setItems(kundenSet);
            grid2.setVisible(true);
            this.kundenSet = kundenSet;

        }
    }

    @Async
    public ListenableFuture<String> sendMail() {
        try {
            Object[] temparr = new Object[kundenSet.size()];
            temparr = kundenSet.toArray();
            login.login(smtpHost, smtpPort, userData.getUsername(), userData.getPassword());
            MailSender mailSender = new MailSender();
            mailSender.setMailSession(login.getMailSession());
            int counter = 0;

            for (int i = 0; i < temparr.length; i++) {
                Kunde kunde = (Kunde) temparr[i];
                System.out.println(kunde.getVorname());
                mailSender.sendMail(userData.getUsername(), absender.getValue(), kunde.getMail(), betreff.getValue(), stringToHtmlText(mailText.getValue()));
                counter += 1;
            }
            return AsyncResult.forValue("Versenden von: " + counter + " Mails erfolgreich.");
        } catch (MessagingException e) {
            e.printStackTrace();
            return AsyncResult.forValue("Mails wurden nicht gesendet, da ein Fehler beim versenden aufgetreten ist! Fehlercode: " +
                    e.getMessage());
        } catch (UnsupportedEncodingException e) {
            return AsyncResult.forValue("Mails wurden nicht gesendet, da die Mail nicht richtig codiert worden ist!" +
                    e.getMessage());
        } catch (NullPointerException e) {
            return AsyncResult.forValue("Mails wurden nicht gesendet, da keine Empfänger ausgewählt worden sind!");
        }

    }

    public void showErrorNot() {
        Notification notification = new Notification();
        notification.addThemeVariants(NotificationVariant.LUMO_ERROR);

        Div text = new Div(new Text("Authentifizierung fehlgeschlagen! E-Mail und Passwort überprüfen"));

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

    public void showSuccesNot() {
        Notification notification = new Notification();
        notification.addThemeVariants(NotificationVariant.LUMO_SUCCESS);

        Div text = new Div(new Text("Authentifizierung erfolgreich!"));

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
    private String stringToHtmlText(String text) {
        return HtmlEncoder.textToHTML(text);
    }

    public void updateList() {
        grid.setItems(kundenDataService.findAllKundenWithKlasse(filterText.getValue()));
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

