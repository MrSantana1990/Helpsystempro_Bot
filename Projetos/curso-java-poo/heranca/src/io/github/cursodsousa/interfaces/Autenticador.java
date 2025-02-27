package io.github.cursodsousa.interfaces;

public class Autenticador {

    public boolean autenticar( Autenticacao autenticacao ){
        String identificacao = autenticacao.getIdentificacao();

        if(autenticacao.isUsaSenha()){
            String senha = autenticacao.getSenha();
            // pego a senha desse usuario na base atraves da identificao
            // verifico se a senha da base é igual a senha passada
            return true;
        } else {
            // buscar pessoa no banco de dados atraves da idenficacao
            // se encontrou a pessoa
            return true;
        }
    }
}
