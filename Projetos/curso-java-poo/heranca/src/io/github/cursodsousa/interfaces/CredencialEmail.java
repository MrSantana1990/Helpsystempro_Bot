package io.github.cursodsousa.interfaces;

public class CredencialEmail implements Autenticacao  {

    private String email;
    private String senha;

    public CredencialEmail(String email, String senha) {
        this.email = email;
        this.senha = senha;
    }

    @Override
    public String getIdentificacao() {
        return this.email;
    }

    @Override
    public String getSenha() {
        return this.senha;
    }

    @Override
    public boolean isUsaSenha() {
        return true;
    }
}
