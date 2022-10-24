package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.ComponentEvent;
import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.binder.BeanValidationBinder;
import com.vaadin.flow.data.binder.Binder;
import com.vaadin.flow.data.binder.ValidationException;
import com.vaadin.flow.shared.Registration;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;

public class InputForm extends FormLayout {
    Binder<Kunde> binder = new BeanValidationBinder<>(Kunde.class);
    private Kunde kunde;
    TextField vorname = new TextField("Vorname");
    TextField nachname = new TextField("Nachname");
    TextField adresse = new TextField("Adresse");
    TextField plz = new TextField("Plz");
    TextField stadt = new TextField("Stadt");
    TextField klasse = new TextField("Klasse");
    TextField mail = new TextField("Mail");
    TextField tel = new TextField("Telefon");
    Button save = new Button("Save");
    Button delete = new Button("Delete");
    Button close = new Button("Cancel");

    public InputForm() {
        addClassName("contact-form");
        binder.bindInstanceFields(this);
        klasse.setMaxLength(1);
        add(vorname, nachname, adresse,plz ,stadt,klasse, mail, tel,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        save.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        delete.addThemeVariants(ButtonVariant.LUMO_ERROR);
        close.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        save.addClickShortcut(Key.ENTER);
        close.addClickShortcut(Key.ESCAPE);

        save.addClickListener(event -> validateAndSave());
        delete.addClickListener(event -> fireEvent(new DeleteEvent(this, kunde)));
        close.addClickListener(event -> fireEvent(new CloseEvent(this)));

        binder.addStatusChangeListener(e -> save.setEnabled(binder.isValid()));
        return new HorizontalLayout(save, delete, close);
    }

    public static abstract class KundeFormEvent extends ComponentEvent<InputForm> {
        private Kunde kunde;

        protected KundeFormEvent(InputForm source, Kunde kunde) {
            super(source, false);
            this.kunde = kunde;
        }

        public Kunde getKunde() {
            return this.kunde;
        }
    }


    public void setKunde(Kunde kunde) {
        this.kunde = kunde;
        binder.readBean(kunde);
    }


    public static class SaveEvent extends KundeFormEvent {
        SaveEvent(InputForm source, Kunde kunde) {
            super(source, kunde);
        }
    }

    public static class DeleteEvent extends KundeFormEvent {
        DeleteEvent(InputForm source, Kunde kunde) {
            super(source, kunde);
        }

    }

    public static class CloseEvent extends KundeFormEvent {
        CloseEvent(InputForm source) {
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


}

