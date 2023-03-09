package lukegoll.schulranzen.aachen.webservices.data.entity;

import javax.persistence.Entity;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

@Entity
public class Kunde extends AbstractEntity {
    @NotBlank
    private String vorname;

    @NotBlank
    private String nachname;

    @NotBlank
    private String adresse;

    @NotBlank
    private String plz;

    @NotBlank
    private String stadt;

    @NotBlank
    private String jahr;

    @Email
    @NotBlank
    private String mail;

    @NotBlank
    private String tel;

   /* @NotBlank
    private String productName;
    @NotBlank
    private int productId;*/


    public String getVorname() {
        return vorname;
    }

    public void setVorname(String vorname) {
        this.vorname = vorname;
    }

    public String getNachname() {
        return nachname;
    }

    public void setNachname(String nachname) {
        this.nachname = nachname;
    }

    public String getAdresse() {
        return adresse;
    }

    public void setAdresse(String adresse) {
        this.adresse = adresse;
    }

    public String getPlz() {
        return plz;
    }

    public void setPlz(String plz) {
        this.plz = plz;
    }

    public String getStadt() {
        return stadt;
    }

    public void setStadt(String stadt) {
        this.stadt = stadt;
    }

    public String getJahr() {
        return jahr;
    }

    public void setJahr(String klasse) {
        this.jahr = klasse;
    }

    public String getMail() {
        return mail;
    }

    public void setMail(String mail) {
        this.mail = mail;
    }

    public String getTel() {
        return tel;
    }

    public void setTel(String tel) {
        this.tel = tel;
    }

   /* public int getProductId() {
        return productId;
    }

    public void setProductId(int productId) {
        this.productId = productId;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }*/
}
