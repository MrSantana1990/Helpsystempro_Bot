package io.github.cursodsousa.clientes.logicanegocio;

import io.github.cursodsousa.clientes.dados.ClienteDAO;
import io.github.cursodsousa.clientes.dominio.Cliente;

import java.util.Optional;
import java.util.UUID;

public class LogicaCadastroBancoDados implements Cadastro<Cliente> {

    private ClienteDAO clienteDAO;

    public LogicaCadastroBancoDados(ClienteDAO clienteDAO) {
        this.clienteDAO = clienteDAO;
    }

    @Override
    public void salvar(Cliente cliente) throws Exception {
        ValidadorCliente.validar(cliente);
        clienteDAO.inserir(cliente);
    }

    @Override
    public Optional<Cliente> buscar(UUID codigo) {
        return Optional.empty();
    }

    @Override
    public void deletar(UUID codigo) {
        clienteDAO.deletar(codigo);
    }

    @Override
    public void atualizar(Cliente cliente) {
        clienteDAO.atualizar(cliente);
    }

    @Override
    public void imprimirRegistros() {
        clienteDAO.listar().forEach(System.out::println);
    }
}
