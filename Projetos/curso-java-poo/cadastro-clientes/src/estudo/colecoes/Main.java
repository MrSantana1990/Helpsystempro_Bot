package estudo.colecoes;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.enums.TipoSexo;

import java.util.*;

public class Main {
    public static void main(String[] args) {
        OrganizacaoClientes cadastro = new OrganizacaoClientes();

        Cliente cliente = new Cliente();
        cliente.setCpf("0123");
        cliente.setNome("Cicrano");
        cliente.setSexo(TipoSexo.M);

        cadastro.adicionar(cliente);

        Cliente cliente2 = new Cliente();
        cliente2.setCpf("01234");
        cliente2.setNome("Maria");
        cliente2.setSexo(TipoSexo.F);

        cadastro.adicionar(cliente2);

        Cliente cliente3 = new Cliente();
        cliente3.setCpf("01234");
        cliente3.setNome("Rita");
        cliente3.setSexo(TipoSexo.F);

        cadastro.adicionar(cliente3);

        Cliente cliente4 = new Cliente();
        cliente4.setCpf("01234");
        cliente4.setNome("Alguem");
        cliente4.setSexo(TipoSexo.O);

        cadastro.adicionar(cliente4);

        System.out.println("Femininos:");
        cadastro.imprimirClientes(TipoSexo.F);

        System.out.println("Masculinos:");
        cadastro.imprimirClientes(TipoSexo.M);

        System.out.println("Outros:");
        cadastro.imprimirClientes(TipoSexo.O);

        List<TipoSexo> tipoSexos = cadastro.obterTiposAdicionados();
        for(TipoSexo tipo : tipoSexos){
            System.out.println(tipo.getDescricao());
        }

    }

    private static void exemplosMaps() {
        Map<Integer, String> mapa = new HashMap<>();
        mapa.put(1, "Fulano");
        mapa.put(2, "Cicrano");
        mapa.put(3, "Maria");

        String nome = mapa.get(3);
        System.out.println(nome);

        mapa.remove(1);

        System.out.println(mapa.get(1));

        boolean contemChave = mapa.containsKey(2);
        System.out.println("Contem a chave 2: " + contemChave);

        boolean contemValor = mapa.containsValue("Fulano");
        System.out.println("Contem o valor Fulano? " + contemValor);
    }

    private static void trabalhandoComOrdenacaoDeColecoes() {
        Cliente cliente = new Cliente();
        cliente.setCpf("0123");
        cliente.setNome("Cicrano");
        cliente.setSexo(TipoSexo.M);

        Cliente cliente2 = new Cliente();
        cliente2.setCpf("01234");
        cliente2.setNome("Cicrano");
        cliente2.setSexo(TipoSexo.F);

        List<Cliente> clientes = Arrays.asList(cliente, cliente2);

        clientes.sort(Cliente::compareTo);

        clientes.sort(new Comparator<Cliente>() {
            @Override
            public int compare(Cliente o1, Cliente o2) {
                return o1.getCodigo().compareTo(o2.getCodigo());
            }
        });

        for (Cliente c : clientes ){
            System.out.println(c);
        }
    }

    private static void repositorioComSet(){
        Set<String> liguagens = new TreeSet<>();
        liguagens.add("Java");
        liguagens.add("Python");
        liguagens.add("Javascript");

        for (String l : liguagens){
            System.out.println(l);
        }
    }

    private static void repositorioComList(){
        List<Cliente> listaClientes = new ArrayList<>();

        Cliente cliente = new Cliente();
        cliente.setCpf("0123");
        cliente.setNome("Fulano");
        cliente.setSexo(TipoSexo.M);

        Cliente cliente2 = new Cliente();
        cliente2.setCpf("01234");
        cliente2.setNome("Cicrano");
        cliente2.setSexo(TipoSexo.F);

        listaClientes.add(cliente);
        listaClientes.add(cliente2);

        for (Cliente c : listaClientes ){
            System.out.println(c);
        }

        Cliente clienteRepetido = new Cliente();
        clienteRepetido.setCpf("0123");
        clienteRepetido.setNome("Fulano");
        clienteRepetido.setSexo(TipoSexo.M);

        boolean contem = listaClientes.contains(clienteRepetido);
        System.out.println("Contem? " + contem);
    }

    private static void repositorioComArray(){
        RepositorioClientes repositorioClientes = new RepositorioClientes();

        Cliente cliente = new Cliente();
        cliente.setCpf("0123");
        cliente.setNome("Fulano");
        cliente.setSexo(TipoSexo.M);

        Cliente cliente2 = new Cliente();
        cliente2.setCpf("01234");
        cliente2.setNome("Cicrano");
        cliente2.setSexo(TipoSexo.F);

        repositorioClientes.adicionar(cliente);
        repositorioClientes.adicionar(cliente2);
        repositorioClientes.imprimirClientes();
    }
}
