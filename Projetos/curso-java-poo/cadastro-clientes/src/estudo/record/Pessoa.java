package estudo.record;

// POJO -> Plain Old Java Object

public class Pessoa {

    private final String nome;
    private final String cpf;

    public Pessoa(String nome, String cpf) {
        this.nome = nome;
        this.cpf = cpf;
    }

    public String getNome() {
        return nome;
    }

    public String getCpf() {
        return cpf;
    }

}
