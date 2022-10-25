package lukegoll.schulranzen.aachen.webservices.data.entity;

import javax.persistence.Entity;
import javax.validation.constraints.NotBlank;

@Entity
public class MailText extends AbstractEntity {

    @NotBlank
    private String text;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
