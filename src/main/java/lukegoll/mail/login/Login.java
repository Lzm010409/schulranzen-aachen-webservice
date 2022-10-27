package lukegoll.mail.login;

import lukegoll.mail.send.MailSender;

import javax.mail.*;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.util.Date;
import java.util.Properties;


public class Login {
    private Session mailSession;
    private MailSender mailSender;

    private String smtpHost = "smtp.vodafonemail.de";
    private String smtpPort = "465";


    public void login(String smtpHost, String smtpPort, String username, String password) {
        Properties properties = new Properties();
        properties.put("mail.smtp.host", smtpHost);
        properties.put("mail.smtp.socketFactory.port", smtpPort);
        properties.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.port", smtpPort);

        Authenticator authenticator = new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(username, password);
            }
        };
        try {
            this.mailSession = Session.getDefaultInstance(properties, authenticator);
            System.out.println("Eingeloggt...");
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

    public int tryToAuthenticate(String smtpHost, String smtpPort,String username, String password) {
        int exitcode = 0;
        login(smtpHost, smtpPort, username, password);
        try {
            if (getMailSession() == null) {
                System.out.println("Bitte erst anmelden!");
            }
            MimeMessage msg = new MimeMessage(mailSession);
            msg.addHeader("Content-type", "text/HTML; charset=UTF-8");
            msg.addHeader("format", "flowed");
            msg.addHeader("Content-Transfer-Encoding", "8-bit");

            msg.setFrom(new InternetAddress(username, "Authenticator"));
            msg.setSubject("Erfolgreich angemeldet", "UTF-8");
            //msg.setText(message, "UTF-8");

            msg.setContent("Erfolgreich in der Kunden-Datenbank angemeldet", "text/html");
            msg.setSentDate(new Date());

            msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse("lukegollenstede@gmail.com", false));
            System.out.println("Versende Mail....");
            Transport.send(msg);
            System.out.println("Mail Versendet!");
            return exitcode;
        } catch (AuthenticationFailedException e) {
            System.out.println("Authentication fehlgeschlagen");
            return exitcode = 1;
        } catch (MessagingException e) {
            return exitcode = 2;
        } catch (UnsupportedEncodingException e) {
            return exitcode = 3;
        }
    }


    public Session getMailSession() {
        return mailSession;
    }

    public void setMailSession(Session mailSession) {
        this.mailSession = mailSession;
    }

    public MailSender getMailSender() {
        return mailSender;
    }

    public void setMailSender(MailSender mailSender) {
        this.mailSender = mailSender;
    }


}
