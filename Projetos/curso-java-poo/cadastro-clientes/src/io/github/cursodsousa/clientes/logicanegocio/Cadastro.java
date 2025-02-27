package io.github.cursodsousa.clientes.logicanegocio;

import io.github.cursodsousa.clientes.dominio.exception.CpfInvalidoException;

import java.util.Optional;
import java.util.UUID;

public interface Cadastro<TIPO> {
    void salvar(TIPO objetoCadastrar) throws Exception;
    Optional<TIPO> buscar(UUID codigo);
    void deletar(UUID codigo);
    void atualizar(TIPO objetoAtualizar);
    void imprimirRegistros();
}
