public class InicializacaoArrays {
    public static void main(String[] args) {
        int idade = 30;
        int[] numeroImpares = { 1,3,5,7,9 };
        String nome = "Fulano da silva";
        String telefone1 = "118896687";
        String telefone2 = "218899875";


        String[] filhos = {"Zé", "Maria", "Pedro", "Rita"};

        System.out.println(filhos[3]);
        System.out.println(filhos[2]);
        System.out.println(filhos[1]);
        System.out.println(filhos[0]);


        String nomePrimeiroFilho = filhos[0];
        String nomeSegundoFilho = filhos[1];

        String[] telefones = new String[2];

        System.out.println("Telefone 1 quando array vazio: " + telefones[0] );

        telefones[0] = "118898798798";
        telefones[1] = "217779987879";

        System.out.println("Primeiro Telefone: "+ telefones[0]);
        System.out.println("Segundo Telefone: "+ telefones[1]);

        int[] outrosNumeros = new int[5];
        System.out.println("Valor: " + outrosNumeros[1]);
    }
}
