package lukegoll.csv;

import lukegoll.schulranzen.aachen.webservices.data.KundenDataService;
import lukegoll.schulranzen.aachen.webservices.data.entity.Kunde;
import lukegoll.schulranzen.aachen.webservices.data.entity.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith({MockitoExtension.class})
class CsvUtilTest {
    @Mock
    KundenDataService kundenDataService;


    @InjectMocks
    CsvUtil csvUtil;

    @BeforeEach
    public  void init() {

        Kunde kunde1 = new Kunde("Luke", "Test", "TEst", "Test", "Test", LocalDate.now(), "Test", "Test", new Product("test"));
        Kunde kunde2 = new Kunde("TEST2", "Test", "TEst", "Test", "Test", LocalDate.now(), "Test", "Test", new Product("test"));

        Mockito.lenient().when(kundenDataService.findAll()).thenReturn(new ArrayList<>(Arrays.asList(kunde1, kunde2)));
    }

    @Test
    void exportKundenTest() {

        File file = csvUtil.exportKundenAsFile("src/test/resources/test.csv");
        assertNotNull(file);
    }

    @Test
    void exportKundenWithNullValuesTest() {
        File file = csvUtil.exportKundenAsFile(null);
        assertNull(file);
    }
    @Test
    void exportKundenWithEmptyValuesTest() {
        File file = csvUtil.exportKundenAsFile("");
        assertNull(file);
    }

}