package io.github.cursodsousa.interfaces;

public class CarroHibrido implements CarroEletrico, CarroCombustao {

    @Override
    public void abastecer() {

    }

    @Override
    public void carregarBateria() {

    }

    @Override
    public void fazAlgo() {
        CarroEletrico.super.fazAlgo();
    }
}
