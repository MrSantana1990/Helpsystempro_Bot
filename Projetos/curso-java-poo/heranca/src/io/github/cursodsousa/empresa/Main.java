package io.github.cursodsousa.empresa;

public class Main {
    public static void main(String[] args) {
        Tecnico tecnico = new Tecnico();
        tecnico.setNome("Fulano");
        tecnico.setSalario(1500);
        tecnico.setCpf("01234567890");

        tecnico.imprimirRemuneracao();

        Gerente gerente = new Gerente();
        gerente.setNome("Gerentão");
        gerente.setSalario(3000);
        gerente.setCpf("9876543210");

        Funcionario outroGerente = new Tecnico();
        Funcionario outroTecnico = new Gerente();

        gerente.imprimirRemuneracao();

        System.out.println("Bonus anual: ");
        System.out.println("Gerente: " + gerente.calcularBonificacaoAnual());
        System.out.println("Tecnico: " + tecnico.calcularBonificacaoAnual());

        ConexaoBancaria conexaoBancaria = new ConexaoBancaria();
        GerenciaRH gerenciaRH = new GerenciaRH(conexaoBancaria);
        gerenciaRH.pagarBonificacaoAnual(gerente);
        gerenciaRH.pagarBonificacaoAnual(tecnico);
    }
}
