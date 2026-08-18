package lukegoll.schulranzen.aachen.webservices.views.home;

import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.Text;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.details.Details;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.Span;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.router.RouteAlias;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;
import org.springframework.beans.factory.annotation.Value;

import java.util.ArrayList;
import java.util.List;

@PageTitle("Home")
@Route(value = "home", layout = MainLayout.class)
@RouteAlias(value = "", layout = MainLayout.class)
public class HomeView extends HorizontalLayout {

    private TextField name;
    private Button sayHello;

    /**
     * Die Kontaktangaben standen frueher fest im Quelltext. Sie kommen jetzt aus
     * der Konfiguration, damit im Repository keine personenbezogenen Daten
     * liegen. Sind sie nicht gesetzt, entfaellt der Abschnitt.
     */
    public HomeView(
            @Value("${app.support.name:}") String supportName,
            @Value("${app.support.email:}") String supportEmail,
            @Value("${app.support.phone:}") String supportPhone) {

        H1 title = new H1("Auf den folgenden Seiten können Sie die Kunden-Daten angeben und Mails versenden");

        VerticalLayout verticalLayout = new VerticalLayout(title);

        List<Span> contactLines = new ArrayList<>();
        addIfPresent(contactLines, supportName);
        addIfPresent(contactLines, supportEmail);
        addIfPresent(contactLines, supportPhone);

        if (!contactLines.isEmpty()) {
            VerticalLayout content = new VerticalLayout();
            content.setSpacing(false);
            content.setPadding(false);
            contactLines.forEach(content::add);

            Details details = new Details("Bei Fragen", content);
            details.setOpened(true);
            verticalLayout.add(details);
        }

        add(verticalLayout);
    }

    private static void addIfPresent(List<Span> target, String value) {
        if (value != null && !value.trim().isEmpty()) {
            target.add(new Span(value.trim()));
        }
    }

}
