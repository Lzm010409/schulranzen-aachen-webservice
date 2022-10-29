package lukegoll.schulranzen.aachen.webservices.data.entity;

import javax.persistence.Entity;
import javax.validation.constraints.NotBlank;

@Entity
public class Provider extends AbstractEntity {

    @NotBlank
    private String providerName;
    @NotBlank
    private String smtpHost;
    @NotBlank
    private String smtpPort;

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public String getSmtpHost() {
        return smtpHost;
    }

    public void setSmtpHost(String smtpHost) {
        this.smtpHost = smtpHost;
    }

    public String getSmtpPort() {
        return smtpPort;
    }

    public void setSmtpPort(String smtpPort) {
        this.smtpPort = smtpPort;
    }
}
