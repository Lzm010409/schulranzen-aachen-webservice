package lukegoll.schulranzen.aachen.webservices.views.mail;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.notification.NotificationVariant;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.PasswordField;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.MailTextDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailText;
import lukegoll.schulranzen.aachen.webservices.list.InputForm;
import lukegoll.schulranzen.aachen.webservices.list.MailForm;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;

import javax.annotation.security.PermitAll;
import java.util.*;

@PageTitle("Mail")
@Route(value = "mail", layout = MainLayout.class)
public class MailView extends VerticalLayout {
    Grid<Kunde> grid = new Grid<>(Kunde.class);
    Grid<Kunde> grid2 = new Grid<>(Kunde.class);
    KundenDataService kundenDataService;
    MailTextDataService kundenMailDataService;
    Set<Kunde> kundenSet;

    MailForm mailForm;

    TextField filterText = new TextField();
    EmailField emailField = new EmailField();
    PasswordField passwordField = new PasswordField();
    Button signIn = new Button("Anmelden");
    List<Kunde> liste = new ArrayList<>();
    Login login = new Login();


    public void setSmtpPort(String smtpPort) {
        this.smtpPort = smtpPort;
    }

    private String smtpHost;
    private String smtpPort;


    UserData userData = new UserData();

    public MailView(KundenDataService kundenDataService) {
        this.kundenDataService = kundenDataService;
        addClassName("list-view");
        setSizeFull();
        configureGrid();
        configureGridSelectedKunden();
        configureMailForm();
        configureToolbar();
        add(getContent());
        updateList();

    }


    public Component getContent() {
        HorizontalLayout content1 = new HorizontalLayout(grid2, mailForm);
        content1.setFlexGrow(2, grid2);
        content1.setFlexGrow(1, mailForm);
        content1.addClassName("content");
        content1.setSizeFull();

        VerticalLayout content = new VerticalLayout(createMailLogin(), filterText, grid, content1);


        return content;
    }

    public HorizontalLayout createMailLogin() {
        emailField.setPlaceholder("E-Mail Adresse");
        emailField.setErrorMessage("Das ist keine valide E-Mail");
        emailField.setClearButtonVisible(true);

        passwordField.setPlaceholder("Passwort");
        passwordField.setRevealButtonVisible(true);
        //passwordField.setHelperText("Das Passwort muss mit dem Mail-Account Passwort übereinstimmen, sonst können keine Mails versendet werden.");
        signIn.addClickListener(buttonClickEvent -> loginIn(emailField.getValue(), passwordField.getValue()));
        HorizontalLayout mailLogin = new HorizontalLayout(emailField, passwordField, signIn);
        return mailLogin;
    }

    private void loginIn(String user, String password) {
        int exitcode = 0;
        try {
            exitcode = login.tryToAuthenticate(smtpHost, smtpPort, user, password);
            if (exitcode == 0) {
                userData.setUsername(user);
                userData.setPassword(password);
                showSuccesNot();
                filterText.setVisible(true);
                grid.setVisible(true);
                grid2.setVisible(true);
                mailForm.setVisible(true);


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
        grid.setColumns("klasse", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid.getColumns().forEach(col -> col.setAutoWidth(true));
        grid.setHeight("100");
        grid.setSelectionMode(Grid.SelectionMode.MULTI);
        grid.setVisible(false);
        grid.addSelectionListener(selectionEvent -> uebertrageKundenData(selectionEvent.getAllSelectedItems()));
        grid.addSelectionListener(selectionEvent -> editMail(selectionEvent.getAllSelectedItems()));

    }

    public void configureGridSelectedKunden() {
        grid2.addClassNames("contact-grid-mail");
        grid2.setSizeFull();
        grid2.setColumns("klasse", "vorname", "nachname", "adresse", "stadt", "mail", "tel");
        grid2.getColumns().forEach(col -> col.setAutoWidth(true));
        grid2.setVisible(false);

    }

    public void configureToolbar() {
        filterText.setPlaceholder("Nach Klasse filtern...");
        filterText.setValueChangeMode(ValueChangeMode.LAZY);
        filterText.addValueChangeListener(event -> updateList());
        filterText.setVisible(false);

    }


    private void editMail(Set<Kunde> kundenSet) {
        if (kundenSet.isEmpty()) {
            closeEditor();
        } else {
            mailForm.setKundeSet(kundenSet);
            addClassName("editing");


        }
    }

    public void configureMailForm() {
        mailForm = new MailForm(userData.getUsername(), userData.getPassword());
        mailForm.setWidth("25em");
        mailForm.setVisible(false);
        // mailForm.addListener(MailForm.SendEvent.class, this::);
        // mailForm.addListener(InputForm.CloseEvent.class, event -> closeEditor());
    }

    public void closeEditor() {
        //mailForm.setMailAdress(null);
        mailForm.setVisible(false);
        removeClassName("editing");
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
