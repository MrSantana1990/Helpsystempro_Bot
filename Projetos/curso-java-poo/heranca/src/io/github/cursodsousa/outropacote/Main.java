package io.github.cursodsousa.outropacote;

import io.github.cursodsousa.heranca.Animal;
import io.github.cursodsousa.heranca.Panda;

public class Main {
    public static void main(String[] args) {
        Cachorro cachorro = new Cachorro(5);
        cachorro.setNome("Roy");
        cachorro.latir();
    }
}
