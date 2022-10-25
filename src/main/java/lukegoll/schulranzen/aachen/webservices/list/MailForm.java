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
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailText;

import java.util.List;

public class MailForm extends FormLayout {

    // Binder<MailText> binder = new BeanValidationBinder<>(MailText.class);
    Binder<TextArea> mailBinder = new BeanValidationBinder<>(TextArea.class);

    List<Kunde> kundenList;
    private MailText mailText;

    //TextField mails = new TextField("E-Mail Adressen");
    TextArea text = new TextArea("Inhalt der Mail");


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

        sendMails.addClickListener(buttonClickEvent -> sendMail());
        // sendMails.addClickListener(event -> validateAndSave());
        //cancel.addClickListener(event -> fireEvent(new CloseEvent(this)));

        //binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(sendMails, cancel);
    }

    private void sendMail() {
        try {
            mailBinder.writeBean(text);
            fireEvent(new SendEvent(this, mailText.getText()));
        } catch (ValidationException e) {
            e.printStackTrace();
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

    public MailText getMailText() {
        return this.mailText;
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

}

