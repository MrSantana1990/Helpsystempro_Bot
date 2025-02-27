package sistemabancario;

public class Conta {

    private Cliente titular;
    private int numero;
    private double saldo;

    public Conta(Cliente titular, int numero, double saldo){
        this.titular = titular;
        this.numero = numero;
        if(saldo >= 0){
            this.saldo = saldo;
        }
    }

    public void setSaldo(double saldo){
        if(saldo >= 0){
            this.saldo = saldo;
        }else{
            System.out.println("Saldo não foi alterado. Valor negativo.");
        }
    }

    public double getSaldo(){
        return this.saldo;
    }

    public void imprimirSaldo(){
        System.out.println("Saldo atual para a conta " +
                this.numero + ": " + this.saldo);
    }

    public Cliente getTitular() {
        return titular;
    }

    public void setTitular(Cliente titular) {
        this.titular = titular;
    }

    public int getNumero() {
        return numero;
    }

    public void setNumero(int numero) {
        this.numero = numero;
    }
}
