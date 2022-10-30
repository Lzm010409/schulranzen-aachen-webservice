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
import lukegoll.mail.TextEncoder.HtmlEncoder;
import lukegoll.mail.data.ServerData;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import lukegoll.mail.send.MailSender;
import lukegoll.schulranzen.aachen.webservices.data.ProviderDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Provider;
import org.apache.catalina.User;

import javax.mail.MessagingException;
import java.io.UnsupportedEncodingException;
import java.util.Set;

public class MailForm extends FormLayout {
    // Binder<MailText> binder = new BeanValidationBinder<>(MailText.class);
    Binder<TextArea> mailBinder = new BeanValidationBinder<>(TextArea.class);

    //TextField mails = new TextField("E-Mail Adressen");


    TextArea text = new TextArea("Text");

    Set<Kunde> kundeSet;
    private Kunde kunde;

    private UserData userData = new UserData();
    private Provider provider = new Provider();

    Login login = new Login();
    MailSender mailSender = new MailSender();

    private double progress = 0;

    private boolean sendeVorgang = false;

    private String mailText;


    Button sendMails = new Button("Versenden");
    Button cancel = new Button("Abbrechen");

    public MailForm(UserData userData) {
        userData.setUsername(userData.getUsername());
        userData.setPassword(userData.getPassword());
        addClassName("contact-form");
        mailBinder.forField(text).bind(TextArea::getValue, TextArea::setValue);
        add(text,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        sendMails.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        cancel.addThemeVariants(ButtonVariant.LUMO_TERTIARY);
        cancel.addClickShortcut(Key.ESCAPE);
        sendMails.addClickListener(buttonClickEvent -> sendMail());
        // sendMails.addClickListener(event -> validateAndSave());
        //cancel.addClickListener(event -> fireEvent(new CloseEvent(this)));

        //binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(sendMails, cancel);
    }

    private void sendMail() {
        this.setMailText(text.getValue());
        Object[] temparr = new Object[kundeSet.size()];
        temparr = kundeSet.toArray();
        login.login(provider.getSmtpHost(), provider.getSmtpPort(), userData.getUsername(), userData.getPassword());
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

    public void setMailText(String text) {
        String umbruch = "\n";
        this.mailText = HtmlEncoder.textToHTML(text);
        System.out.println(mailText);
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


    public TextArea getText() {
        return text;
    }

    public void setText(TextArea text) {
        this.text = text;
    }

    public double getProgress() {
        return progress;
    }

    public void setProgress(double progress) {
        this.progress = progress;
    }

    public boolean isSendeVorgang() {
        return sendeVorgang;
    }

    public void setSendeVorgang(boolean sendeVorgang) {
        this.sendeVorgang = sendeVorgang;
    }

    public Provider getProvider() {
        return provider;
    }

    public void setProvider(Provider provider) {
        this.provider = provider;
    }

}

