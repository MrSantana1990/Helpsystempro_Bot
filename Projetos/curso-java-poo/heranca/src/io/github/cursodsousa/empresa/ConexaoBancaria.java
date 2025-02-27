package io.github.cursodsousa.empresa;

public class ConexaoBancaria {
    public void enviarPagamento(String cpf, double valor){
        System.out.println("CPF: " + cpf + " - Pagamento enviado: " + valor);
    }
}
