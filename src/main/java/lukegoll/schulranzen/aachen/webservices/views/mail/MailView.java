package lukegoll.schulranzen.aachen.webservices.views.mail;

import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.views.MainLayout;
import lukegoll.schulranzen.aachen.webservices.views.kunden.KundenView;

@PageTitle("Mail")
@Route(value = "mail", layout = MainLayout.class)
public class MailView extends VerticalLayout {
    KundenDataService kundenDataService;
    KundenView kundenView;
    public MailView(){

    }

    private Component getContent(){
        HorizontalLayout horizontalLayout = new HorizontalLayout(kundenView.getGrid());
        setSizeFull();
        return horizontalLayout;
    }

}
