package io.github.cursodsousa.clientes.logicanegocio;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.exception.CpfInvalidoException;
import io.github.cursodsousa.clientes.utilitario.GerenciadorArquivos;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class LogicaCadastroMemoria implements Cadastro<Cliente> {

    private List<Cliente> lista;

    public LogicaCadastroMemoria() {
        this.lista = new ArrayList<>();
    }

    @Override
    public void salvar(Cliente cliente) throws CpfInvalidoException {
        ValidadorCliente.validar(cliente);
        this.lista.add(cliente);
        GerenciadorArquivos.persistirArquivo(cliente.getNome() + ".jpg", cliente.getFoto());
    }

    @Override
    public Optional<Cliente> buscar(UUID codigo) {

        Cliente clienteEncontrado = null;

        for (Cliente c : this.lista){
            if(c.getCodigo().equals(codigo)){
                clienteEncontrado = c;
                break;
            }
        }

        return Optional.ofNullable(clienteEncontrado);
    }

    @Override
    public void deletar(UUID codigo) {
        this.buscar(codigo)
                .ifPresentOrElse(
                        cliente -> lista.remove(cliente),
                        () -> System.out.println("Cliente não removido, pois codigo era inexistente") );
    }

    @Override
    public void atualizar(Cliente cliente) {
        // faz sentido ao trabalhar com banco de dados
    }

    @Override
    public void imprimirRegistros() {
        System.out.println("Imprimindo " + this.lista.size() + " clientes:");
        for (Cliente cliente : this.lista ){
            System.out.println(cliente);
        }
    }
}
