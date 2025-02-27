package io.github.cursodsousa.interfaces;

public class CredencialBiometrica implements Autenticacao {

    private byte[] fotoRosto;

    public CredencialBiometrica(byte[] fotoRosto) {
        this.fotoRosto = fotoRosto;
    }

    @Override
    public String getIdentificacao() {
        return new String(this.fotoRosto);
    }

    @Override
    public String getSenha() {
        return null;
    }

    @Override
    public boolean isUsaSenha() {
        return false;
    }
}
