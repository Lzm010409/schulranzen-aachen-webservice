package lukegoll.mail.send;

import com.vaadin.flow.component.upload.receivers.MultiFileMemoryBuffer;
import lukegoll.mail.data.ServerData;
import lukegoll.mail.data.UserData;
import lukegoll.mail.login.Login;
import org.apache.catalina.User;

import javax.mail.*;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import java.io.*;
import java.util.*;

public class MailSender {


    private Session mailSession;
    private String senderAdress;
    private String senderName;
    private String receiverAdress;
    private String subject;
    private String message;

    public void sendMail(String senderAdress, String senderName, String receiverAdress, String subject, String message) throws MessagingException, UnsupportedEncodingException {
        if (mailSession == null) {
            throw new IllegalStateException("Erst einloggen!");
        }

        MimeMessage msg = new MimeMessage(mailSession);
        msg.addHeader("Content-type", "text/HTML; charset=UTF-8");
        msg.addHeader("format", "flowed");
        msg.addHeader("Content-Transfer-Encoding", "8-bit");

        msg.setFrom(new InternetAddress(senderAdress, senderName));
        msg.setReplyTo(InternetAddress.parse(senderAdress, false));
        msg.setSubject(subject, "UTF-8");
        //msg.setText(message, "UTF-8");

        msg.setContent(message, "text/html");
        msg.setSentDate(new Date());

        msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(receiverAdress, false));
        System.out.println("Versende Mail....");
        Transport.send(msg);
        System.out.println("Mail Versendet!");

    }

    public void sendMail(String senderAdress, String senderName, String receiverAdress, String subject, String message, MultiFileMemoryBuffer multiFileMemoryBuffer) throws MessagingException, UnsupportedEncodingException {
        List<File> tempFileList = new ArrayList<>();
        if (mailSession == null) {
            throw new IllegalStateException("Erst einloggen!");
        }
        MimeMessage msg = new MimeMessage(mailSession);
        msg.addHeader("Content-type", "text/HTML; charset=UTF-8");
        msg.addHeader("format", "flowed");
        msg.addHeader("Content-Transfer-Encoding", "8-bit");

        msg.setFrom(new InternetAddress(senderAdress, senderName));
        msg.setReplyTo(InternetAddress.parse(senderAdress, false));
        msg.setSubject(subject, "UTF-8");
        //msg.setText(message, "UTF-8");
        BodyPart messageBodyPart = new MimeBodyPart();
        messageBodyPart.setText(message);
        Multipart multipart = new MimeMultipart();
        if (multiFileMemoryBuffer != null && multiFileMemoryBuffer.getFiles().size() > 0) {
            Iterator<String> fileIterator = multiFileMemoryBuffer.getFiles().iterator();
            while (fileIterator.hasNext()) {
                String fileName = fileIterator.next();
                File file = new File(fileName);
                tempFileList.add(file);
                MimeBodyPart attachmentPart = new MimeBodyPart();
                try (FileOutputStream fileOutputStream = new FileOutputStream(file)) {
                    byte[] arr = multiFileMemoryBuffer.getOutputBuffer(fileName).toByteArray();
                    fileOutputStream.write(arr);
                    attachmentPart.attachFile(file);
                    multipart.addBodyPart(attachmentPart);
                } catch (FileNotFoundException e) {
                    throw new RuntimeException(e);

                } catch (NullPointerException e) {

                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        multipart.addBodyPart(messageBodyPart);
        msg.setContent(multipart);
        msg.setSentDate(new

                Date());


        msg.setSentDate(new

                Date());

        msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(receiverAdress, false));
        System.out.println("Versende Mail....");
        try {
            Transport.send(msg);
        } catch (MessagingException e) {
            throw new MessagingException("Nachricht konnte nicht versendet werden!");
        } finally {
            if (tempFileList.size() > 0) {
                for (File file : tempFileList) {
                    file.delete();
                }
            }
        }
        System.out.println("Mail Versendet!");

    }


    public Session getMailSession() {
        return mailSession;
    }

    public void setMailSession(Session mailSession) {
        this.mailSession = mailSession;
    }

    public String getSenderAdress() {
        return senderAdress;
    }

    public void setSenderAdress(String senderAdress) {
        this.senderAdress = senderAdress;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getReceiverAdress() {
        return receiverAdress;
    }

    public void setReceiverAdress(String receiverAdress) {
        this.receiverAdress = receiverAdress;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
