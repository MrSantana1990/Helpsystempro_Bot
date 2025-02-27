package io.github.cursodsousa.clientes.dominio;

import io.github.cursodsousa.clientes.dominio.enums.TipoSexo;

import java.util.Arrays;
import java.util.UUID;

public class Cliente implements Comparable<Cliente> {

    private UUID codigo;
    private String nome;
    private String cpf;
    private TipoSexo sexo;
    private Integer idade;
    private Boolean ativo;
    private byte[] foto;

    public Cliente(){
        this.codigo = UUID.randomUUID();
        System.out.println("Código do cliente: " + this.codigo.toString());
    }

    public Integer getIdade() {
        return idade;
    }

    public void setIdade(Integer idade) {
        this.idade = idade;
    }

    public UUID getCodigo() {
        return codigo;
    }

    public void setCodigo(UUID codigo) {
        this.codigo = codigo;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public TipoSexo getSexo() {
        return sexo;
    }

    public void setSexo(TipoSexo sexo) {
        this.sexo = sexo;
    }

    public byte[] getFoto() {
        return foto;
    }

    public void setFoto(byte[] foto) {
        this.foto = foto;
    }

    @Override
    public String toString() {
        return "Cliente [" +
                "codigo=" + codigo +
                ", nome='" + nome + '\'' +
                ", cpf='" + cpf + '\'' +
                ", sexo=" + sexo +
                ", foto=" + Arrays.toString(foto) +
                ']';
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) return true;
        if (object == null || getClass() != object.getClass()) return false;

        Cliente cliente = (Cliente) object;

        if (!codigo.equals(cliente.codigo)) return false;
        if (!nome.equals(cliente.nome)) return false;
        if (!cpf.equals(cliente.cpf)) return false;
        return sexo == cliente.sexo;
    }

    @Override
    public int hashCode() {
        int result = codigo.hashCode();
        result = 31 * result + nome.hashCode();
        result = 31 * result + cpf.hashCode();
        result = 31 * result + sexo.hashCode();
        return result;
    }

    /**
     *
     * @param o the object to be compared.
     * @return
     *
     * 0 -> são iguais -> 1 == 1
     * 1 -> é maior -> 2 > 1
     * -1 -> é menor -> 1 < 2
     */

    @Override
    public int compareTo(Cliente o) {
        int fator = this.nome.compareTo(o.getNome());
        if(fator == 0){
            fator = this.sexo.equals(TipoSexo.F) ? -1 : 1;
        }
        return fator;
    }
}
