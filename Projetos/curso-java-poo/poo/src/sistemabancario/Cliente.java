package sistemabancario;

public class Cliente {

    public static int quantidadeClientes;

    private String cpf;
    private String nome;

    public Cliente(){
        incrementarClientes();
    }

    public Cliente(String cpf, String nome){
        this.cpf = cpf;
        this.nome = nome;
        incrementarClientes();
    }
    //padrão get e set
    public void setCpf(String cpf){
        this.cpf = cpf;
    }

    public String getCpf(){
        return this.cpf;
    }

    public void setNome(String nome){
        this.nome = nome;
    }

    public String getNome(){
        return this.nome;
    }

    public static void incrementarClientes(){
        Cliente.quantidadeClientes++;
    }
}
