package sistemabancario;

public class Main {

    public static void main(String[] args) {

        Cliente fulano = new Cliente("01234567890", "Fulano");
        Conta contaFulano = new Conta(fulano, 1000, -50);

        System.out.println("Saldo da conta fulano: " + contaFulano.getSaldo());

        Banco sistemaBancario = new Banco();

        contaFulano.imprimirSaldo();

        System.out.println("Depositando 100 reais ");
        sistemaBancario.depositar(contaFulano, 100d);

        System.out.println("Saldo depois do depósito:");
        contaFulano.imprimirSaldo();

        System.out.println("Sacando o valor de 30 reais");
        sistemaBancario.sacar(contaFulano, 30d);

        contaFulano.imprimirSaldo();

        System.out.println("Sacando o valor de 200 reais");
        sistemaBancario.sacar(contaFulano, 200d);

        contaFulano.imprimirSaldo();

        Cliente cicrano = new Cliente();
        cicrano.setNome("Cicrano");
        cicrano.setCpf("9876543210");

        Conta contaCicrano = new Conta(cicrano, 2000, 0);
        contaCicrano.setSaldo(50);
        contaCicrano.imprimirSaldo();

        System.out.println("Transferindo 120 reais para o cicrano:");
        sistemaBancario.transferir(contaFulano, contaCicrano, 120d);

        contaFulano.imprimirSaldo();
        contaCicrano.imprimirSaldo();

       System.out.println("Quantidade Clientes: " + Cliente.quantidadeClientes);
    }
}
