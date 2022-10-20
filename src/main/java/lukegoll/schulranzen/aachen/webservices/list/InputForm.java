package lukegoll.schulranzen.aachen.webservices.list;

import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.textfield.TextField;

public class InputForm extends FormLayout {
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

        add(vorname, nachname, adresse, plz, stadt, klasse, mail, tel,
                createButtonsLayout());
    }

    private HorizontalLayout createButtonsLayout() {
        save.addThemeVariants(ButtonVariant.LUMO_PRIMARY);
        delete.addThemeVariants(ButtonVariant.LUMO_ERROR);
        close.addThemeVariants(ButtonVariant.LUMO_TERTIARY);

        save.addClickShortcut(Key.ENTER);
        close.addClickShortcut(Key.ESCAPE);

        return new HorizontalLayout(save, delete, close);
    }
}

