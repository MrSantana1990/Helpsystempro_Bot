package io.github.cursodsousa.heranca;

public class Main {
    public static void main(String[] args) {
        Panda panda = new Panda(50);
        panda.imprimirDados();

        Hipopotamo hipopotamo = new Hipopotamo(30, 100);
        hipopotamo.imprimirDados();
    }
}