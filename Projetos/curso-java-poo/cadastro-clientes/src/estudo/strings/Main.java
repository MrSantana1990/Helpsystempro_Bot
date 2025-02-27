package estudo.strings;

public class Main {

    static String valor = "Maçã";

    public static void main(String[] args) {
        String hello = "Hello";

        System.out.println("Parece com hello: " + hello.equalsIgnoreCase("heLLo"));
        System.out.println("Começa com He?: "+ hello.startsWith("He"));
        System.out.println("Começa com Lo?: "+ hello.endsWith("lo"));

        String nomeCompleto = "Fulano da silva sauro";
        String[] partesDoNome = nomeCompleto.split(" ");
        System.out.println(partesDoNome[0]);
        System.out.println(partesDoNome[1]);
        System.out.println(partesDoNome[2]);
        System.out.println(partesDoNome[3]);
    }

    private static void tamanhoString(){
        int tamanho = valor.length();
        System.out.println("Tamanho: " + tamanho);
    }

    private static void pegarCaracteres(){
        char caractere = valor.charAt(0);
        char ultimo = valor.charAt(valor.length() - 1 );
        System.out.println("Primeiro e ultimo Caracteres: "
                + caractere + " e " +ultimo);
    }

    private static void trabalhandoComSubstring(){
        String pedaco = valor.substring(0, 3);
        System.out.println("pedaço da string: " + pedaco);
    }

    private static void exemploIndexOf(){
        int indice = valor.indexOf("R");
        System.out.println("Indice letra a: " + indice);

        String nome = "Pedro da Silva";

        // -1 -> valor não encontrado na string
        indice = nome.indexOf("Silva");

        System.out.println("Indice encontrado: " + indice);

        if(nome.indexOf("Pedro") != -1){
            System.out.println("Encontrei! " + nome);
        } else {
            System.out.println("Não encontrei esse pedaço no nome.");
        }
    }

    private static void exemplosCase(){
        String string = "Silva";

        String caixaAlta = string.toUpperCase();

        System.out.println("Caixa alta: " + caixaAlta);

        String caixaBaixa = string.toLowerCase();

        System.out.println("Caixa baixa: " + caixaBaixa);

        System.out.println("String original: " + string);
    }

    private static void removerEspacosEmBranco(){
        String string = "      Pedro da Silva      ";
        String stringSemOsEspacos = string.trim();
        System.out.println(stringSemOsEspacos.length());
        System.out.println(stringSemOsEspacos);
    }

    private static void replace(){
        String novaMaca = valor
                .replace("ã", "a")
                .replace("ç", "c");
        System.out.println(novaMaca);

        String cpf = "012.345.678-90";
        System.out.println(cpf
                .replace(".", "")
                .replace("-", ""));
    }
}
