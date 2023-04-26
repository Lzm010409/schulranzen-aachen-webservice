package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.ComponentEvent;
import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.confirmdialog.ConfirmDialog;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.binder.BeanValidationBinder;
import com.vaadin.flow.data.binder.Binder;
import com.vaadin.flow.data.binder.ValidationException;
import com.vaadin.flow.shared.Registration;
import lukegoll.schulranzen.aachen.webservices.data.ProductDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Product;
import lukegoll.schulranzen.aachen.webservices.views.converter.LocalDateConverter;
import org.springframework.beans.factory.annotation.Autowired;

public class InputForm extends FormLayout {
    Binder<Kunde> binderKunde = new BeanValidationBinder<>(Kunde.class);
    // Binder<Product> binderProduct = new BeanValidationBinder<>(Product.class);
    private Kunde kunde;
    private Product product;
    private ProductDataService productDataService;
    TextField vorname = new TextField("Vorname");
    TextField nachname = new TextField("Nachname");
    TextField adresse = new TextField("Adresse");
    TextField plz = new TextField("Plz");
    TextField stadt = new TextField("Stadt");
    DatePicker kaufdatum = new DatePicker("Kaufdatum");
    TextField mail = new TextField("Mail");
    TextField tel = new TextField("Telefon");
    // ComboBox<Product> productName = new ComboBox<>("Produkt");

    ComboBox<Product> productComboBox = new ComboBox<>("Produkte");
    Button save = new Button("Save");
    Button delete = new Button("Delete");
    Button close = new Button("Cancel");


    public InputForm(ProductDataService productDataService) {
        this.productDataService = productDataService;
        addClassName("contact-form");
        configureKundenBinder();
        configureProductComobBox();
        add(vorname, nachname, adresse, plz, stadt, kaufdatum, mail, tel, productComboBox,
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

    private void configureProductComobBox() {
        productComboBox.setItems(productDataService.findAll());
        productComboBox.setItemLabelGenerator(Product::getProductName);
        productComboBox.setAllowCustomValue(true);
        productComboBox.addCustomValueSetListener(
                e -> {
                    String customValue = e.getDetail();
                    Product product1 = new Product(customValue);
                    /*productDataService.saveProduct(product1);
                    productComboBox.setItems(productDataService.findAll());*/
                    productComboBox.setValue(product1);
                }
        );
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

    private void configureDatePicker() {
        DatePicker.DatePickerI18n singleFormatI18n = new DatePicker.DatePickerI18n();
        singleFormatI18n.setDateFormat("yyyy-MM-dd");
        kaufdatum.setI18n(singleFormatI18n);
    }

    private void configureKundenBinder() {
        binderKunde.forField(vorname).bind(Kunde::getVorname, Kunde::setVorname);
        binderKunde.forField(nachname).bind(Kunde::getNachname, Kunde::setNachname);
        binderKunde.forField(adresse).bind(Kunde::getAdresse, Kunde::setAdresse);
        binderKunde.forField(plz).bind(Kunde::getPlz, Kunde::setPlz);
        binderKunde.forField(stadt).bind(Kunde::getStadt, Kunde::setStadt);
        binderKunde.forField(kaufdatum).bind(Kunde::getKaufdatum, Kunde::setKaufdatum);
        binderKunde.forField(mail).bind(Kunde::getMail, Kunde::setMail);
        binderKunde.forField(tel).bind(Kunde::getTel, Kunde::setTel);
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

    private void validateAndSaveKunde() {
        try {
            binderKunde.writeBean(kunde);
            kunde.setProduct(productComboBox.getValue());
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

