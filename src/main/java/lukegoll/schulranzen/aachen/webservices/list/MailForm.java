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
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunden;

public class MailForm extends FormLayout {
    Binder<Kunden> binder = new BeanValidationBinder<>(Kunden.class);
    private Kunden kunde;

    TextField mails = new TextField("E-Mail Adressen");
    TextArea text = new TextArea("Inhalt der Mail");
    Button sendMails = new Button("Versenden");
    Button cancel = new Button("Abbrechen");

    public MailForm() {
        addClassName("contact-form");
        //binder.bindInstanceFields(this);
        add(mails, text,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        sendMails.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        cancel.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        sendMails.addClickShortcut(Key.ENTER);
        cancel.addClickShortcut(Key.ESCAPE);

       // sendMails.addClickListener(event -> validateAndSave());
        //cancel.addClickListener(event -> fireEvent(new CloseEvent(this)));

        //binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(sendMails,cancel);
    }

   /* public static abstract class KundeFormEvent extends ComponentEvent<MailForm> {
        private Kunden kunde;

        protected KundeFormEvent(MailForm source, Kunden kunde) {
            super(source, false);
            this.kunde = kunde;
        }

        public Kunden getKunde() {
            return this.kunde;
        }
    }


    public void setKunde(Kunden kunde) {
        this.kunde = kunde;
        binder.readBean(kunde);
    }


    public static class SaveEvent extends KundeFormEvent {
        SaveEvent(MailForm source, Kunden kunde) {
            super(source, kunde);
        }
    }

    public static class DeleteEvent extends KundeFormEvent {
        DeleteEvent(MailForm source, Kunden kunde) {
            super(source, kunde);
        }

    }

    public static class CloseEvent extends KundeFormEvent {
        CloseEvent(MailForm source) {
            super(source, null);
        }
    }

    public <T extends ComponentEvent<?>> Registration addListener(Class<T> eventType,
                                                                  ComponentEventListener<T> listener) {
        return getEventBus().addListener(eventType, listener);
    }

    private void validateAndSave() {
        try {
            binder.writeBean(kunde);
            fireEvent(new SaveEvent(this, kunde));

        } catch (ValidationException e) {
            e.printStackTrace();
        }
    }
*/

}

