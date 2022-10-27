package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.ComponentEvent;
import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextArea;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.binder.BeanValidationBinder;
import com.vaadin.flow.data.binder.Binder;
import com.vaadin.flow.shared.Registration;
import lukegoll.mail.data.ServerData;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.mail.send.MailSender;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;

import javax.mail.MessagingException;
import java.io.UnsupportedEncodingException;
import java.util.Set;

public class MailForm extends FormLayout {
    // Binder<MailText> binder = new BeanValidationBinder<>(MailText.class);
    Binder<TextArea> mailBinder = new BeanValidationBinder<>(TextArea.class);

    //TextField mails = new TextField("E-Mail Adressen");
    TextField anrede = new TextField("Anrede");

    TextArea text = new TextArea("Text");
    TextField verabschiedung = new TextField("Verabschiedung");
    TextField absender = new TextField("Absender");
    Set<Kunde> kundeSet;
    private Kunde kunde;

    UserData userData = new UserData();
    ServerData server = new ServerData();
    Login login = new Login();
    MailSender mailSender = new MailSender();


    private String mailText;


    Button sendMails = new Button("Versenden");
    Button cancel = new Button("Abbrechen");

    public MailForm(String user, String password) {
        this.userData.setUsername(user);
        this.userData.setPassword(password);
        addClassName("contact-form");
        mailBinder.forField(anrede).bind(TextArea::getValue, TextArea::setValue);
        mailBinder.forField(text).bind(TextArea::getValue, TextArea::setValue);
        mailBinder.forField(verabschiedung).bind(TextArea::getValue, TextArea::setValue);
        mailBinder.forField(absender).bind(TextArea::getValue, TextArea::setValue);
        add(anrede, text, verabschiedung, absender,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        sendMails.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        cancel.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        sendMails.addClickShortcut(Key.ENTER);
        cancel.addClickShortcut(Key.ESCAPE);

        sendMails.addClickListener(buttonClickEvent -> sendMail());
        // sendMails.addClickListener(event -> validateAndSave());
        //cancel.addClickListener(event -> fireEvent(new CloseEvent(this)));

        //binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(sendMails, cancel);
    }

    private void sendMail() {
        this.setMailText(anrede.getValue(), text.getValue(), verabschiedung.getValue(), absender.getValue());

        Object[] temparr = new Object[kundeSet.size()];
        temparr = kundeSet.toArray();
        login.login(server.getSmtpHost(), server.getSmtpPort(), userData.getUsername(), userData.getPassword());
        mailSender.setMailSession(login.getMailSession());

        try {
            for (int i = 0; i < temparr.length; i++) {
                kunde = (Kunde) temparr[i];
                System.out.println(kunde.getVorname());
                mailSender.sendMail(userData.getUsername(), "Luke", kunde.getMail(), "Test", this.getMailText());
            }
        } catch (MessagingException e) {
            e.printStackTrace();
        } catch (UnsupportedEncodingException e) {

        }
        System.out.println(anrede.getValue());

    }


    public static abstract class MailFormEvent extends ComponentEvent<MailForm> {
        private String text;

        protected MailFormEvent(MailForm source, String text) {
            super(source, false);
            this.text = text;
        }

        public String getText() {
            return this.text;
        }
    }

    public static class SendEvent extends MailFormEvent {
        SendEvent(MailForm source, String text) {
            super(source, text);
        }
    }


    public <T extends ComponentEvent<?>> Registration addListener(Class<T> eventType,
                                                                  ComponentEventListener<T> listener) {
        return getEventBus().addListener(eventType, listener);
    }

    public String getMailText() {
        return this.mailText;
    }

    public void setMailText(String anrede, String text, String verabschiedung, String absender) {
        String umbruch ="\n";
        this.mailText = String.join(anrede, "\n" , text , "\n" , verabschiedung , "\n" , absender);
        System.out.println(mailText);
    }


    public String getAnrede() {
        return anrede.getValue();
    }

    public void setAnrede(String anrede) {
        this.anrede.setValue(anrede);
    }

    public Button getSendMails() {
        return sendMails;
    }

    public void setSendMails(Button sendMails) {
        this.sendMails = sendMails;
    }

    public Button getCancel() {
        return cancel;
    }

    public void setCancel(Button cancel) {
        this.cancel = cancel;
    }

    public Set<Kunde> getKundeSet() {
        return kundeSet;
    }

    public void setKundeSet(Set<Kunde> kundeSet) {
        this.kundeSet = kundeSet;
    }

    public UserData getUserData() {
        return userData;
    }

    public void setUserData(UserData userData) {
        this.userData = userData;
    }

    public ServerData getServer() {
        return server;
    }

    public void setServer(ServerData server) {
        this.server = server;
    }

    public Login getLogin() {
        return login;
    }

    public void setLogin(Login login) {
        this.login = login;
    }

    public MailSender getMailSender() {
        return mailSender;
    }

    public void setMailSender(MailSender mailSender) {
        this.mailSender = mailSender;
    }

    public Kunde getKunde() {
        return kunde;
    }

    public void setKunde(Kunde kunde) {
        this.kunde = kunde;
    }

    public void setAnrede(TextField anrede) {
        this.anrede = anrede;
    }

    public TextArea getText() {
        return text;
    }

    public void setText(TextArea text) {
        this.text = text;
    }

    public TextField getVerabschiedung() {
        return verabschiedung;
    }

    public void setVerabschiedung(TextField verabschiedung) {
        this.verabschiedung = verabschiedung;
    }

    public TextField getAbsender() {
        return absender;
    }

    public void setAbsender(TextField absender) {
        this.absender = absender;
    }


}

