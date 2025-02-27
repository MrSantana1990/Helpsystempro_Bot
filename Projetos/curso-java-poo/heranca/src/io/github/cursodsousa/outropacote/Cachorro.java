package io.github.cursodsousa.outropacote;

import io.github.cursodsousa.heranca.Animal;

public class Cachorro extends Animal {

    public Cachorro(int idade){
        super("Cachorro", idade);
    }

    public void latir(){
        imprimirDados();
    }
}
