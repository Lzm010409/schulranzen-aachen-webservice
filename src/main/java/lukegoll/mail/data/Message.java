package lukegoll.mail.data;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Scanner;

public class Message {
    private File message;
    private String messageText = "";

    private Scanner scanner;


    public void createMessage() {
        try {
            scanner = new Scanner(message);
        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }
        while (scanner.hasNext()) {
            messageText += scanner.nextLine();
        }


    }

    public String getMessageText() {
        return messageText;
    }

    public void setMessageText(String messageText) {
        this.messageText = messageText;
    }

    public Scanner getScanner() {
        return scanner;
    }

    public void setScanner(Scanner scanner) {
        this.scanner = scanner;
    }

    public File getMessage() {
        return message;
    }

    public void setMessage(File message) {
        this.message = message;
    }
}
