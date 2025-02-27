package io.github.cursodsousa.clientes.dominio.enums;

public enum TipoSexo {

    M("Masculino"),
    F("Feminino"),
    O("Outros");

    private final String descricao;

    TipoSexo(String descricao){
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
