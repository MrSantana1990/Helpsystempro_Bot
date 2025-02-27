import java.util.Scanner;

public class LoopComWhile {
    public static void main(String[] args) {

        Scanner scanner = new Scanner(System.in);

        System.out.println("Digite o valor:");
        int contador = scanner.nextInt();
        int valor = 1;

        while( valor <= contador ){
            if(valor % 2 == 1){
                System.out.println(valor);
            }
            valor++;
        }

        scanner.close();
    }
}
