package estudo.exceptions;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.exception.CpfInvalidoException;
import io.github.cursodsousa.clientes.dominio.exception.DadoObrigatorioException;
import io.github.cursodsousa.clientes.logicanegocio.ValidadorCliente;

import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
//        try {
//            Cliente cliente = new Cliente();
//            cliente.setSexo(TipoSexo.F);
//            String descricao = cliente.getSexo().getDescricao();
//            System.out.println(descricao);
//        } catch (NullPointerException e) {
//            System.out.println("O tipo sexo estava null!");
//        } catch (Exception e) {
//            System.out.println("Ocorreu um erro inexperado!");
//        }


//        Cliente cliente = new Cliente();
//        cliente.setCpf("01234567890");
//
//        try {
//            ValidadorCliente.validar(cliente);
//            System.out.println("CPF OK!");
//        } catch (CpfInvalidoException e) {
//            System.out.println(e.getMessage());
//        } catch (DadoObrigatorioException e) {
//            System.out.println(e.getMessage());
//        } catch (Exception e) {
//            System.out.println("Erro inesperado!");
//        } finally {
//            System.out.println("Fui Executado no finally");
//        }

        Scanner scanner = new Scanner(System.in);

        try {
            Cliente c = new Cliente();
            String cpf = scanner.nextLine();
            c.setCpf(cpf);

            ValidadorCliente.validar(c);

        } catch (CpfInvalidoException ex){
            System.out.println("CPF Inválido");
        } finally {
            System.out.println("Fechando o scanner:");
            scanner.close();
            System.out.println("Scanner fechado");
        }

    }
}
