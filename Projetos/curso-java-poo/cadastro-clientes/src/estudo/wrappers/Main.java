package estudo.wrappers;

import io.github.cursodsousa.clientes.dominio.Cliente;

public class Main {

    static int valor;
    static Integer valorWrapper;

    public static void main(String[] args) {
        // Wrappers

        int numeroInteiro = 10;
        Integer inteiroWrapper = 10;

//        System.out.println(valor);
        System.out.println(new Cliente().getIdade());

        Double valorDouble = 10.0d;
        Short valorShort = 1;
        Float valorFloat = 1f;

        String valorNumero = "10";
        Integer idade = Integer.valueOf(valorNumero);
        Double valorDouble2 = Double.valueOf("10.0");

        String valorString = idade.toString();

        Integer variavel = 100;
        int primitivo = variavel.intValue();

    }
}
