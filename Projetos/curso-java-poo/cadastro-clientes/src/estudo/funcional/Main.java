package estudo.funcional;

public class Main {
    public static void main(String[] args) {

        // implementação via classe anonima
        Calculadora soma = new Calculadora() {
            @Override
            public int calcular(int x, int y) {
                return x + y;
            }
        };

        // expressão lambda
        soma = (x, y) -> x + y;

        System.out.println(soma.calcular(1,1));

        Calculadora substracao = (num, num2) -> num - num2;

        System.out.println("Subtracao:");
        System.out.println(substracao.calcular(20, 10));

        Calculadora calc = (y, x) -> {
          var valor = y * 2;
          return valor + x;
        };

        Executor executor = param -> substracao.calcular(50, 30);
        executor.executa(50);
    }

}
