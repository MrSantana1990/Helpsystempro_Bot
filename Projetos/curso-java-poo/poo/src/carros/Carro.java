package carros;

public class Carro {

    int cavalos;
    String cor;
    String transmissao;
    String montadora;
    int capacidadeTanque;
    int combustivel;
    int kmPorLitros;

    int abastecer(int litros){
        int soma = combustivel + litros;
        if(soma > capacidadeTanque){
            combustivel = capacidadeTanque;
            int sobra = soma - capacidadeTanque;
            return sobra;
        } else {
            combustivel = soma;
            return 0;
        }
    }

    int autonomiaCombustivel(){
        int autonomia = kmPorLitros * combustivel;
        return autonomia;
    }
}
