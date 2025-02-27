package estudo.funcional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class EstudoStreams {
    public static void main(String[] args) {
        List<String> nomes =
                List.of("Ana", "Ana", "Maria", "Pedro", "Elizabete", "Marcos");

        nomes.stream().forEach(System.out::println);

        System.out.println("Nomes até 5 caracteres:");
        nomes.stream()
                .filter(nome -> nome.length() <= 5 )
                .sorted()
                .distinct()
                .forEach(System.out::println);

        List<Character> primeirasLetras =
                nomes.stream()
                        .map(nome -> nome.charAt(0))
                        .collect(Collectors.toList());

        primeirasLetras.forEach(letra -> System.out.println(letra));

        List<Character> lista = new ArrayList<>();
        for(String nome: nomes){
            if(nome.length() <= 5){
                char primeiraLetra = nome.charAt(0);
                lista.add(primeiraLetra);
                System.out.println(primeiraLetra);
            }
        }
    }
}
