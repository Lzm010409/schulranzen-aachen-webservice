package lukegoll.csv;

import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;

@Component
public class CsvUtil {


    private KundenDataService kundenDataService;

    @Autowired
    public CsvUtil(KundenDataService kundenDataService) {
        this.kundenDataService = kundenDataService;
    }


    public File exportKundenAsFile(String outputPath) {
        String SAMPLE_CSV_FILE = outputPath + "/kunden" + LocalDate.now().toString() + ".csv";
        BufferedWriter writer = null;
        try {
            writer = Files.newBufferedWriter(Paths.get(SAMPLE_CSV_FILE));
        } catch (IOException | NullPointerException e) {
            return null;
        }
        List<Kunde> kundes = kundenDataService.findAll();
        CSVFormat csvFormat = CSVFormat.DEFAULT.builder()
                .setHeader("Vorname", "Nachname", "Adresse", "Stadt", "PLZ", "Mail", "Telefon", "Produkt", "Kaufdatum")
                .build();

        try {
            final CSVPrinter printer = new CSVPrinter(writer, csvFormat);
            for (Kunde kunde : kundes) {
                try {
                    printer.printRecord(kunde.getVorname(), kunde.getNachname(), kunde.getAdresse(), kunde.getStadt(), kunde.getPlz(), kunde.getMail(), kunde.getTel(), kunde.getProduct().getProductName(), kunde.getKaufdatum());
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
            printer.flush();
            return new File(SAMPLE_CSV_FILE);
        } catch (IOException e) {
            return null;
        }
    }
}
