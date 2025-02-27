package io.github.cursodsousa.interfaces;

public class Main {
    public static void main(String[] args) {

        CarroHibrido carroHibrido = new CarroHibrido();
        carroHibrido.fazAlgo();

        Autenticador autenticador = new Autenticador();

        Autenticacao email = new CredencialEmail("email@fulano.com", "321");
        boolean isAutenticado = autenticador.autenticar(email);

        Autenticacao usuario = new CredencialLogin("username", "password");
        boolean isUsuarioAutenticado = autenticador.autenticar(usuario);

        Autenticacao biometrica = new CredencialBiometrica(new byte[]{});
        boolean isBiometriaAutenticada = autenticador.autenticar(biometrica);
    }
}
