package io.github.cursodsousa.empresa;

public class GerenciaRH {

    private ConexaoBancaria conexaoBancaria;

    public GerenciaRH(ConexaoBancaria conexaoBancaria) {
        this.conexaoBancaria = conexaoBancaria;
    }

    public void pagarBonificacaoAnual(Funcionario funcionario){
        double bonificacao = funcionario.calcularBonificacaoAnual();
        conexaoBancaria.enviarPagamento(funcionario.getCpf(), bonificacao);
        enviarEmail();
    }

    private void enviarEmail(){
        System.out.println("Email enviado!");
    }
}
