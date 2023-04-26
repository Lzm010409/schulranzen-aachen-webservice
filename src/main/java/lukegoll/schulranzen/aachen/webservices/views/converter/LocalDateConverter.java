package lukegoll.schulranzen.aachen.webservices.views.converter;

import com.vaadin.flow.data.binder.Result;
import com.vaadin.flow.data.binder.ValueContext;
import com.vaadin.flow.data.converter.Converter;
import org.springframework.cglib.core.Local;

import java.time.LocalDate;

public class LocalDateConverter implements Converter<LocalDate, String> {


    @Override
    public Result<String> convertToModel(LocalDate localDate, ValueContext valueContext) {
        try {
            return Result.ok(localDate.toString());
        } catch (Exception e) {
            return Result.error("Datum nicht konvertierbar!");
        }
    }

    @Override
    public LocalDate convertToPresentation(String s, ValueContext valueContext) {
        try {
            LocalDate date = LocalDate.parse(s);
            return date;
        } catch (Exception e) {
            return null;
        }
    }
}
