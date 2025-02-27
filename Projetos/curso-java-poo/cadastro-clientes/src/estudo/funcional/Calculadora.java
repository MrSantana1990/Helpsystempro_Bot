package estudo.funcional;

@FunctionalInterface
public interface Calculadora {
    int calcular(int x, int y);

    default void fazAlgo(){

    }

    static void fazAlgoStatic(){

    }
}
