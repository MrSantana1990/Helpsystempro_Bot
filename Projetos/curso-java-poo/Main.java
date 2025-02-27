import javax.swing.JFrame;


public class Main {

	public static void main(String[] args){ 

		JFrame janela = new JFrame();
		
		janela.setTitle("Meu Primeiro Programa!");
		janela.setSize(500, 500);
		janela.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE); // Fechar o programa ao fechar a janela
		janela.setVisible(true);

	}
}