import javax.swing.JFrame;
import javax.swing.WindowConstants;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.JButton;
import javax.swing.JOptionPane;

public class Main {
    public static void main(String[] args) {
        JFrame janela = new JFrame();
        janela.setTitle("Hello World!");
        janela.setSize(500, 500);
        janela.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);

        JLabel labelNome = new JLabel("Nome:");
        labelNome.setBounds(20, 20, 50, 20);

        JTextField campoTextoNome = new JTextField();
        campoTextoNome.setBounds(20, 40, 200, 20);

        JButton botaoEnviar = new JButton();
        botaoEnviar.setText("Enviar");
        botaoEnviar.setBounds(20, 60, 100, 20);
        botaoEnviar.addActionListener(event -> {
            String nomeDigitado = campoTextoNome.getText();
            JOptionPane.showMessageDialog(janela, "Olá : " +  nomeDigitado);
        });

        janela.setLayout(null);
        janela.getContentPane().add(labelNome);
        janela.getContentPane().add(campoTextoNome);
        janela.getContentPane().add(botaoEnviar);

        janela.setVisible(true);

    }
}