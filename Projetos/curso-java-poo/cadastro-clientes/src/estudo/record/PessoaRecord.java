package estudo.record;

// dataclass
public record PessoaRecord(String nome, String cpf) {
    public String getCPFSemFormatacao(){
        // 000.000.000-00
        return this.cpf
                .replace(".", "")
                .replace("-", "");
    }

    public PessoaRecord comNome(String nome){
        return new PessoaRecord(nome, this.cpf());
    }
}
