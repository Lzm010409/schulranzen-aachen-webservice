package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextArea;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.binder.BeanValidationBinder;
import com.vaadin.flow.data.binder.Binder;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.MailListe;

import java.util.List;

public class MailForm extends FormLayout {

    Binder<Kunde> binder = new BeanValidationBinder<>(Kunde.class);
    Binder<MailListe> mailBinder = new BeanValidationBinder<>(MailListe.class);

    private Kunde kunde;
    List<Kunde> kundenList;
    private String mailList;

    TextField mails = new TextField("E-Mail Adressen");
    TextArea text = new TextArea("Inhalt der Mail");


    Button sendMails = new Button("Versenden");
    Button cancel = new Button("Abbrechen");

    public MailForm() {
        addClassName("contact-form");
      //  mailBinder.forField(mails).bind(MailListe::getKunde, MailListe::setKunde);
        binder.forField(mails).bind(Kunde::getMail,Kunde::setMail);
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
        return new HorizontalLayout(sendMails, cancel);
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


    public void setMailAdress(Kunde kunde) {

       /* String mailList = "";
        for (int i = 0; i < kundenList.length; i++) {
            if (i+1 == kundenList.length) {
                mailList += kundenList[i];
            } else {
                mailList += kundenList[i] + ", ";
            }
        }*/
        this.kunde=kunde;
        binder.readBean(kunde);
    }

    /*public void setMailAdress2(Object[]arr) {

        mailList = "";
        for (int i = 0; i < arr.length; i++) {
            this.kunde=(Kunde)arr[i];
            if (i+1 == arr.length) {
                mailList += kunde.getMail();
            } else {
                mailList +=kunde.getMail() + ", ";
            }
        }

        mailBinder.readBean(mailList);
    }*/

    /*
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
    public Binder<Kunde> getBinder() {
        return binder;
    }

    public void setBinder(Binder<Kunde> binder) {
        this.binder = binder;
    }

    public TextField getMails() {
        return mails;
    }

    public void setMails(TextField mails) {
        this.mails = mails;
    }

    public TextArea getText() {
        return text;
    }

    public void setText(TextArea text) {
        this.text = text;
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

