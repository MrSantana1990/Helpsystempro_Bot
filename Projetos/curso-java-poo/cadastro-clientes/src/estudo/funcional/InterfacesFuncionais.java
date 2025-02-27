package estudo.funcional;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.enums.TipoSexo;

import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

public class InterfacesFuncionais {

    public static void main(String[] args) {
        var interfaces = new InterfacesFuncionais();
        System.out.println("Supplier:");
        interfaces.supplier();
        System.out.println("Consumer:");
        interfaces.consumer();
        System.out.println("Predicate:");
        interfaces.predicate();
        System.out.println("Function:");
        interfaces.funcao();
    }

    public void supplier(){
        Supplier<Cliente> provedorCliente = () -> new Cliente();
        System.out.println(provedorCliente.get());
    }

    public void consumer(){
        Consumer<Cliente> impressorNome = (cliente) -> System.out.println(cliente.getNome());

        Cliente cliente = new Cliente();
        cliente.setNome("Zezinho");

        impressorNome.accept(cliente);
    }

    public void predicate(){
        Predicate<Integer> verificaSeEhPar = (numero) -> numero % 2 == 0;

        Predicate<Cliente> verificaSeEhMulher = (cliente) -> TipoSexo.F.equals(cliente.getSexo());

        Cliente cliente = new Cliente();
        cliente.setSexo(TipoSexo.F);

        System.out.println("É mulher?");
        System.out.println(verificaSeEhMulher.test(cliente));
    }

    public void funcao(){
        Function<Cliente, String> mapeadorNome = cliente -> cliente.getNome();

        Cliente cliente = new Cliente();
        cliente.setNome("Maria");

        String nome = mapeadorNome.apply(cliente);

        System.out.println("Nome: " + nome);

    }
}
