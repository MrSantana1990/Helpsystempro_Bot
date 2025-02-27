package io.github.cursodsousa.interfaces;

public interface CarroCombustao {
    void abastecer();

    default void fazAlgo(){
        System.out.println("Faz algo!");
    }
}
