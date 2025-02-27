package io.github.cursodsousa.clientes.dominio.enums;

import io.github.cursodsousa.clientes.dominio.Cliente;

public class Geometria {
    public static void main(String[] args) {
        FormaGeometrica formaGeometrica = FormaGeometrica.CIRCULO;
        int ladosRentagulo = formaGeometrica.getLados();
        System.out.println(ladosRentagulo);

        Cliente cliente = new Cliente();
        cliente.setNome("Fulano");
        cliente.setCpf("0123");
        cliente.setSexo(TipoSexo.F);

        Cliente outroCliente = new Cliente();
        outroCliente.setCodigo(cliente.getCodigo());
        outroCliente.setNome("Fulano");
        outroCliente.setCpf("0123");
        outroCliente.setSexo(TipoSexo.F);

        int numero1 = 10;
        int numero2 = 10;

        boolean osNumerosSaoIguais = numero1 == numero2;

        String nome = new String("Fulano");
        String nome2 = new String("Fulano");

        System.out.println("Eles são iguais? " + cliente.equals(outroCliente) );
    }
}
