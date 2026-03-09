package lukegoll.mail.send;

import com.vaadin.flow.component.upload.receivers.MultiFileMemoryBuffer;
import javax.mail.*;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import java.io.*;
import java.time.LocalDate;
import java.util.*;

public class MailSender {

    private Session mailSession;
    // ... getter/setter für session etc ...

    /**
     * Hilfsmethode zum Zusammenbauen des HTML Contents.
     * Reagiert auf den Platzhalter {Content}
     */
    private String buildHtmlContent(String message, String htmlTemplate) {
        // Zeilenumbrüche aus der TextArea in HTML-Breaks umwandeln, damit die Formatierung bleibt
        String formattedMessage = message != null ? message.replace("\n", "<br>") : "";

        if (htmlTemplate != null && !htmlTemplate.isEmpty() && htmlTemplate.contains("{Content}")) {
            // Template Logik: Injiziere den Text in den Platzhalter
            return htmlTemplate.replace("{Content}", formattedMessage);
        } else if(htmlTemplate != null && !htmlTemplate.isEmpty()) {
            // Möglichkeit ein HTML Template zu versenden, welches eventuell keinen {Content} braucht.
            return htmlTemplate;
        }else {
            // Kein Template: Wir senden den Text direkt (als einfaches HTML)
            // Falls der User schon HTML schreibt, ist das okay, ansonsten wrappen wir es minimal
            return "<html><body>" + formattedMessage + "</body></html>";
        }
    }

    // --- Senden mit Attachments (FileBuffer) ---
    public void sendMail(String senderAdress, String senderName, String receiverAdress, String subject,
                         String message, String htmlTemplate, // NEU: htmlTemplate Parameter
                         MultiFileMemoryBuffer multiFileMemoryBuffer) throws MessagingException, UnsupportedEncodingException {

        if (mailSession == null) throw new IllegalStateException("Erst einloggen!");

        MimeMessage msg = createBaseMessage(senderAdress, senderName, receiverAdress, subject);

        // Content Logik anwenden
        String finalHtmlContent = buildHtmlContent(message, htmlTemplate);

        // BodyPart für den Text/HTML
        BodyPart messageBodyPart = new MimeBodyPart();
        messageBodyPart.setContent(finalHtmlContent, "text/html; charset=UTF-8");

        Multipart multipart = new MimeMultipart();
        multipart.addBodyPart(messageBodyPart);

        // Attachments verarbeiten
        List<File> tempFileList = new ArrayList<>();
        if (multiFileMemoryBuffer != null && !multiFileMemoryBuffer.getFiles().isEmpty()) {
            processAttachments(multiFileMemoryBuffer, multipart, tempFileList);
        }

        msg.setContent(multipart);
        sendAndCleanup(msg, tempFileList);
    }

    // --- Helper Methoden für saubereren Code ---

    private MimeMessage createBaseMessage(String sender, String senderName, String receiver, String subject) throws MessagingException, UnsupportedEncodingException {
        MimeMessage msg = new MimeMessage(mailSession);
        msg.addHeader("Content-type", "text/HTML; charset=UTF-8");
        msg.addHeader("format", "flowed");
        msg.addHeader("Content-Transfer-Encoding", "8-bit");
        msg.setFrom(new InternetAddress(sender, senderName));
        msg.setReplyTo(InternetAddress.parse(sender, false));
        msg.setSubject(subject, "UTF-8");
        msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(receiver, false));
        msg.setSentDate(new Date());
        return msg;
    }

    private void processAttachments(MultiFileMemoryBuffer buffer, Multipart multipart, List<File> tempFiles) throws MessagingException {
        for (String fileName : buffer.getFiles()) {
            File file = new File(fileName);
            tempFiles.add(file);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(buffer.getOutputBuffer(fileName).toByteArray());

                MimeBodyPart attachmentPart = new MimeBodyPart();
                attachmentPart.attachFile(file);
                multipart.addBodyPart(attachmentPart);
            } catch (IOException e) {
                e.printStackTrace(); // Logging wäre hier besser
            }
        }
    }

    private void sendAndCleanup(MimeMessage msg, List<File> tempFiles) throws MessagingException {
        System.out.println("Versende Mail....");
        try {
            Transport.send(msg);
            System.out.println("Mail Versendet!");
        } finally {
            // Aufräumen der temporären Dateien
            tempFiles.forEach(File::delete);
        }
    }

    public void setMailSession(Session mailSession) {
        this.mailSession = mailSession;
    }
}