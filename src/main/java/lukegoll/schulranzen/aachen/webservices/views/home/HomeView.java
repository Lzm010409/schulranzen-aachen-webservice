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

@PageTitle("Home")
@Route(value = "home", layout = MainLayout.class)
@RouteAlias(value = "", layout = MainLayout.class)
public class HomeView extends HorizontalLayout {

    private TextField name;
    private Button sayHello;

    public HomeView() {
        Span name = new Span("Luke Gollenstede");
        Span email = new Span("lukegollenstede@gmail.com");
        Span phone = new Span("+49 1575 1405748");

        VerticalLayout content = new VerticalLayout(name, email, phone);
        content.setSpacing(false);
        content.setPadding(false);

        Details details = new Details("Bei Fragen", content);
        details.setOpened(true);

        H1 title = new H1("Auf den folgenden Seiten können Sie die Kunden-Daten angeben und Mails versenden");

        VerticalLayout verticalLayout = new VerticalLayout(title, details);
        add(verticalLayout);
    }

}
