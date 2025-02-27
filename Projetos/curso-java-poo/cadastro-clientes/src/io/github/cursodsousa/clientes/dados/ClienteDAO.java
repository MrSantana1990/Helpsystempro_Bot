package io.github.cursodsousa.clientes.dados;

import io.github.cursodsousa.clientes.dominio.Cliente;
import io.github.cursodsousa.clientes.dominio.enums.TipoSexo;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

//DAO -> Data Access Object

// CRUD -> Create, Read, Update, Delete
public class ClienteDAO {

    private Connection conexao;

    public ClienteDAO(Connection conexao) {
        this.conexao = conexao;
    }

    public void inserir(Cliente cliente){
        try {
            String comandoSQL = """
                    
                  insert into clientes (codigo, nome, sexo, cpf, idade)
                  values (?, ?, ?, ?, ?)
                         
            """;
            PreparedStatement comando = conexao.prepareStatement(comandoSQL);
            comando.setString(1, cliente.getCodigo().toString());
            comando.setString(2, cliente.getNome());
            comando.setString(3, cliente.getSexo().name());
            comando.setString(4, cliente.getCpf());
            comando.setInt(5, cliente.getIdade());

            comando.execute();

        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    public void atualizar(Cliente cliente){
        try {

            String comandoSQL = """
                 update clientes
                 set nome = ?,
                     sexo = ?,
                     cpf = ?,
                     idade = ?
                 where codigo = ?
            
            """;

            PreparedStatement comando = conexao.prepareStatement(comandoSQL);
            comando.setString(1, cliente.getNome());
            comando.setString(2, cliente.getSexo().name());
            comando.setString(3, cliente.getCpf());
            comando.setInt(4, cliente.getIdade());
            comando.setString(5, cliente.getCodigo().toString());

            comando.execute();

        } catch (SQLException e){
            throw new RuntimeException(e);
        }
    }


    public void deletar(UUID codigo){
        try {

            String comandoSQL = """
                 delete from clientes where codigo = ?           
            """;

            PreparedStatement comando = conexao.prepareStatement(comandoSQL);
            comando.setString(1, codigo.toString());

            comando.execute();

        } catch (SQLException e){
            throw new RuntimeException(e);
        }
    }

    public List<Cliente> listar(){
        try {

            String comandoSQL = """
                 select * from clientes       
            """;

            PreparedStatement comando = conexao.prepareStatement(comandoSQL);

            ResultSet resultado = comando.executeQuery();

            List<Cliente> lista = new ArrayList<>();

            while (resultado.next()){
                String codigo = resultado.getString("codigo");
                String nome = resultado.getString("nome");
                String cpf = resultado.getString("cpf");
                String sexo = resultado.getString("sexo");
                Integer idade = resultado.getInt("idade");

                Cliente cliente = new Cliente();
                cliente.setCodigo(UUID.fromString(codigo));
                cliente.setNome(nome);
                cliente.setCpf(cpf);
                cliente.setSexo(TipoSexo.valueOf(sexo));
                cliente.setIdade(idade);

                lista.add(cliente);
            }

            return lista;

        } catch (SQLException e){
            throw new RuntimeException(e);
        }
    }

}
