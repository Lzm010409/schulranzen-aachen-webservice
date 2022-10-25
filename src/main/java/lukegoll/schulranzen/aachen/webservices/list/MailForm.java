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
import com.vaadin.flow.data.binder.ValidationException;
import com.vaadin.flow.shared.Registration;
import lukegoll.mail.data.ServerData;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.mail.send.MailSender;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailText;

import java.util.List;
import java.util.Set;

public class MailForm extends FormLayout {

    // Binder<MailText> binder = new BeanValidationBinder<>(MailText.class);
    Binder<TextArea> mailBinder = new BeanValidationBinder<>(TextArea.class);

    //TextField mails = new TextField("E-Mail Adressen");
    TextArea text = new TextArea("Inhalt der Mail");

    Set<Kunde> kundeSet;
    private Kunde kunde;

    UserData user = new UserData();
    ServerData server = new ServerData();
    Login login = new Login();
    MailSender mailSender = new MailSender();


    private String mailText;


    Button sendMails = new Button("Versenden");
    Button cancel = new Button("Abbrechen");

    public MailForm() {
        addClassName("contact-form");
        mailBinder.forField(text).bind(TextArea::getValue, TextArea::setValue);
        add(text,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        sendMails.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        cancel.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        sendMails.addClickShortcut(Key.ENTER);
        cancel.addClickShortcut(Key.ESCAPE);

        sendMails.addClickListener(buttonClickEvent -> initMailText());
        // sendMails.addClickListener(event -> validateAndSave());
        //cancel.addClickListener(event -> fireEvent(new CloseEvent(this)));

        //binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(sendMails, cancel);
    }

    private void initMailText() {
        this.setMailText(text.getValue());
        Object[] temparr = new Object[kundeSet.size()];
        temparr = kundeSet.toArray();
        login.login(server.getSmtpHost(), server.getSmtpPort(), user.getUsername(), user.getPassword());
        mailSender.setMailSession(login.getMailSession());

        try {
            for (int i = 0; i < temparr.length; i++) {
                kunde = (Kunde) temparr[i];
                mailSender.sendMail(user.getUserMail(), "Luke", kunde.getMail(), "Test", this.getMailText());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        System.out.println(text.getValue());

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





   /*public static abstract class KundeFormEvent extends ComponentEvent<MailForm> {
        private Kunden kunde;

        protected KundeFormEvent(MailForm source, Kunden kunde) {
            super(source, false);
            this.kunde = kunde;
        }

        public Kunden getKunde() {
            return this.kunde;
        }
    }*/


    public <T extends ComponentEvent<?>> Registration addListener(Class<T> eventType,
                                                                  ComponentEventListener<T> listener) {
        return getEventBus().addListener(eventType, listener);
    }

    public String getMailText() {
        return this.mailText;
    }

    public void setMailText(String mailText) {
        this.mailText = mailText;
    }


    public String getText() {
        return text.getValue();
    }

    public void setText(String text) {
        this.text.setValue(text);
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

    public UserData getUser() {
        return user;
    }

    public void setUser(UserData user) {
        this.user = user;
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


}

