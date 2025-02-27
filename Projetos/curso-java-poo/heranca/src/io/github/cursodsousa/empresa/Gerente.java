package io.github.cursodsousa.empresa;

public class Gerente extends Funcionario {

    @Override
    public double calcularBonificacao() {
        double bonificacaoPadrao = super.calcularBonificacao();
        double remuneracaoGerente = bonificacaoPadrao + 500;
        return remuneracaoGerente;
    }

    @Override
    public double calcularBonificacaoAnual() {
        return getSalario() * 3;
    }
}
