package lukegoll.schulranzen.aachen.webservices.data.entity;

import org.hibernate.validator.constraints.Length;

import javax.persistence.Entity;

@Entity
public class MailTemplate extends AbstractEntity {
    private String name;
    private String subject;
    private String body;
    private Boolean html;

    public MailTemplate(String name, String subject, String body, Boolean html) {
        this.name = name;
        this.subject = subject;
        this.body = body;
        this.html = html;
    }

    public MailTemplate() {

    }

    // Getter und Setter
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public Boolean getHtml() {
        return html;
    }

    public void setHtml(Boolean html) {
        this.html = html;
    }
}
