package io.github.cursodsousa.clientes.dados;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.enums.TipoSexo;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

public class Main {
    public static void main(String[] args) throws SQLException {
        exemploInsert();

        var conexao = FabricaConexoes.criarConexao();
        ClienteDAO dao = new ClienteDAO(conexao);

        List<Cliente> lista = dao.listar();

        lista.forEach(System.out::println);


        conexao.close();
    }

    private static void exemploDelete() throws SQLException {
        var conexao = FabricaConexoes.criarConexao();
        ClienteDAO dao = new ClienteDAO(conexao);

        dao.deletar(UUID.fromString("5a89d018-9f20-42fc-8826-7512ee69a2be"));

        conexao.close();
    }

    private static void exemploAtualizacao() throws SQLException {
        var conexao = FabricaConexoes.criarConexao();
        ClienteDAO dao = new ClienteDAO(conexao);

        Cliente cliente = new Cliente();
        cliente.setCodigo(UUID.fromString("6ab94049-58e6-4421-a5f7-b87584538a63"));
        cliente.setNome("Fulaninho da silva sauro");
        cliente.setIdade(35);
        cliente.setCpf("01234567890");
        cliente.setSexo(TipoSexo.M);

        dao.atualizar(cliente);

        conexao.close();
    }

    private static void exemploInsert() throws SQLException {
        Cliente cliente = new Cliente();
        cliente.setNome("Fulaninho da silva sauro");
        cliente.setIdade(35);
        cliente.setCpf("01234567890");
        cliente.setSexo(TipoSexo.M);

        var conexao = FabricaConexoes.criarConexao();
        ClienteDAO dao = new ClienteDAO(conexao);

        dao.inserir(cliente);

        conexao.close();
    }
}
