package io.github.cursodsousa.clientes.dados;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class FabricaConexoes {

    private static String url = "jdbc:postgresql://localhost:5432/clientes";
    private static String username = "postgres";
    private static String password = "postgres";

    public static Connection criarConexao(){
        try {
            Class.forName("org.postgresql.Driver");
            return DriverManager.getConnection(url, username, password);
        } catch (SQLException e){
            throw new RuntimeException(e);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }
}
