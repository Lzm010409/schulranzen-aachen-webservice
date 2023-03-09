package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.ComponentEvent;
import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.confirmdialog.ConfirmDialog;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.binder.BeanValidationBinder;
import com.vaadin.flow.data.binder.Binder;
import com.vaadin.flow.data.binder.ValidationException;
import com.vaadin.flow.shared.Registration;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Product;

public class InputForm extends FormLayout {
    Binder<Kunde> binderKunde = new BeanValidationBinder<>(Kunde.class);
   // Binder<Product> binderProduct = new BeanValidationBinder<>(Product.class);
    private Kunde kunde;
    private Product product;
    TextField vorname = new TextField("Vorname");
    TextField nachname = new TextField("Nachname");
    TextField adresse = new TextField("Adresse");
    TextField plz = new TextField("Plz");
    TextField stadt = new TextField("Stadt");
    TextField jahr = new TextField("Jahr");
    TextField mail = new TextField("Mail");
    TextField tel = new TextField("Telefon");
   // ComboBox<Product> productName = new ComboBox<>("Produkt");
    Button save = new Button("Save");
    Button delete = new Button("Delete");
    Button close = new Button("Cancel");

    public InputForm() {
        addClassName("contact-form");
        binderKunde.bindInstanceFields(this);
        add(vorname, nachname, adresse, plz, stadt, jahr, mail, tel,
                createButtonsLayout());
    }

    private Component createButtonsLayout() {
        save.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        delete.addThemeVariants(ButtonVariant.LUMO_ERROR);
        close.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        save.addClickShortcut(Key.ENTER);
        close.addClickShortcut(Key.ESCAPE);

        save.addClickListener(event -> validateAndSaveKunde());
        delete.addClickListener(buttonClickEvent -> showDialog());
        close.addClickListener(event -> fireEvent(new CloseEvent(this)));

        binderKunde.addStatusChangeListener(e -> save.setEnabled(binderKunde.isValid()));
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

    public static abstract class ProductEvent extends ComponentEvent<ComboBox> {

        private Product product;

        protected ProductEvent(ComboBox<Product> source, Product product) {
            super(source, false);
            this.product = product;
        }

        public Product getProduct (){
            return  this.product;
        }


    }

    public void showDialog() {
        ConfirmDialog dialog = new ConfirmDialog();
        dialog.open();
        dialog.setHeader("Löschung bestätigen");
        dialog.setText("Wollen Sie das Objekt wirklich löschen?");
        dialog.setConfirmText("Löschen");
        dialog.addConfirmListener(confirmEvent -> fireEvent(new DeleteEvent(this, kunde)));
    }


    public void setKunde(Kunde kunde) {
        this.kunde = kunde;
        binderKunde.readBean(kunde);
    }


    public static class SaveEvent extends KundeFormEvent {
        SaveEvent(InputForm source, Kunde kunde) {
            super(source, kunde);
        }
    }

    public static class SaveEventProduct extends ProductEvent {
        SaveEventProduct(ComboBox<Product> source, Product product) {
            super(source, product);
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

    private void validateAndSaveKunde() {
        try {
            binderKunde.writeBean(kunde);
            fireEvent(new SaveEvent(this, kunde));

        } catch (ValidationException e) {
            e.printStackTrace();
        }
    }

    /*private void validateAndSaveProduct() {
        try {
            binderProduct.writeBean(product);
            fireEvent(new SaveEventProduct(productName, product));

        } catch (ValidationException e) {
            e.printStackTrace();
        }
    }*/


}

