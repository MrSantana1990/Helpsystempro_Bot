import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import javax.swing.*;
import java.awt.*;
import java.io.*;
import java.net.URL;
import java.nio.file.*;
import java.util.Iterator;

public class DownloadGUI extends JFrame {
    private JTextField txtOsNumber;
    private JComboBox<String> cbPlanilha;
    private JButton btnGrupoEmpresaRevenda, btnDownloadIndividual;

    private static final String BASE_URL = "https://alpha.mobato.com.br/";

    public DownloadGUI() {
        setTitle("Download de Arquivos");
        setSize(400, 250);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLayout(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.fill = GridBagConstraints.HORIZONTAL;

        gbc.gridx = 0;
        gbc.gridy = 0;
        add(new JLabel("Selecione o Tipo:"), gbc);

        cbPlanilha = new JComboBox<>(new String[]{"Cliente", "Consultor"});
        gbc.gridx = 1;
        add(cbPlanilha, gbc);

        btnGrupoEmpresaRevenda = new JButton("Baixar por Grupo/Empresa/Revenda");
        btnGrupoEmpresaRevenda.addActionListener(e -> baixarPorGrupoEmpresaRevenda());
        gbc.gridx = 0;
        gbc.gridy = 1;
        gbc.gridwidth = 2;
        add(btnGrupoEmpresaRevenda, gbc);

        gbc.gridx = 0;
        gbc.gridy = 2;
        gbc.gridwidth = 1;
        add(new JLabel("Número da OS para Download Individual:"), gbc);

        txtOsNumber = new JTextField(10);
        gbc.gridx = 1;
        add(txtOsNumber, gbc);

        btnDownloadIndividual = new JButton("Baixar por OS");
        btnDownloadIndividual.addActionListener(e -> baixarIndividual());
        gbc.gridx = 0;
        gbc.gridy = 3;
        gbc.gridwidth = 2;
        add(btnDownloadIndividual, gbc);

        setLocationRelativeTo(null);
        setVisible(true);
    }

    private void baixarPorGrupoEmpresaRevenda() {
        String tipo = cbPlanilha.getSelectedItem().toString();
        String filePath = tipo.equals("Cliente") ? "/assinatura_cliente.xlsx" : "/ass_consultor.xlsx";

        String grupo = JOptionPane.showInputDialog(this, "Digite o número do Grupo:");
        String empresa = JOptionPane.showInputDialog(this, "Digite o número da Empresa:");
        String revenda = JOptionPane.showInputDialog(this, "Digite o número da Revenda:");

        if (grupo == null || empresa == null || revenda == null || grupo.isEmpty() || empresa.isEmpty() || revenda.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Todos os campos são obrigatórios!", "Erro", JOptionPane.ERROR_MESSAGE);
            return;
        }

        processarPlanilha(filePath, false, grupo, empresa, revenda);
    }

    private void baixarIndividual() {
        String tipo = cbPlanilha.getSelectedItem().toString();
        String filePath = tipo.equals("Cliente") ? "/assinatura_cliente.xlsx" : "/ass_consultor.xlsx";
        String osNumber = txtOsNumber.getText().trim();

        if (osNumber.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Digite o número da OS!", "Erro", JOptionPane.ERROR_MESSAGE);
            return;
        }

        processarPlanilha(filePath, true, osNumber);
    }

    private void processarPlanilha(String resourcePath, boolean individual, String... params) {
        try (InputStream is = getClass().getResourceAsStream(resourcePath);
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();
            rowIterator.next(); // Pular cabeçalho

            JFileChooser fileChooser = new JFileChooser();
            fileChooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
            int returnValue = fileChooser.showDialog(this, "Selecionar Pasta");
            if (returnValue != JFileChooser.APPROVE_OPTION) {
                return;
            }
            String baseDownloadPath = fileChooser.getSelectedFile().getAbsolutePath();

            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();

                int grupo = getNumericCellValue(row.getCell(1));
                int empresa = getNumericCellValue(row.getCell(2));
                int revenda = getNumericCellValue(row.getCell(3));
                String nroOsDms = getCellValue(row.getCell(5));
                String pdfEntrada = getCellValue(row.getCell(13));
                String pdfSaida = getCellValue(row.getCell(14));

                if (individual && !nroOsDms.equals(params[0])) {
                    continue;
                } else if (!individual) {
                    if (!params[0].equals(String.valueOf(grupo)) || !params[1].equals(String.valueOf(empresa)) || !params[2].equals(String.valueOf(revenda))) {
                        continue;
                    }
                }

                String osDir = Paths.get(baseDownloadPath, "OS_" + nroOsDms + "_" + grupo + "_" + empresa + "_" + revenda).toString();
                Files.createDirectories(Paths.get(osDir));

                if (!pdfEntrada.isEmpty()) {
                    downloadFile(BASE_URL + pdfEntrada, osDir + "/" + getFileName(pdfEntrada));
                }
                if (!pdfSaida.isEmpty()) {
                    downloadFile(BASE_URL + pdfSaida, osDir + "/" + getFileName(pdfSaida));
                }
            }

            JOptionPane.showMessageDialog(this, "Download concluído!", "Sucesso", JOptionPane.INFORMATION_MESSAGE);
        } catch (Exception e) {
            JOptionPane.showMessageDialog(this, "Erro ao processar a planilha: " + e.getMessage(), "Erro", JOptionPane.ERROR_MESSAGE);
        }
    }

    private void downloadFile(String fileURL, String savePath) {
        try (BufferedInputStream in = new BufferedInputStream(new URL(fileURL).openStream());
             FileOutputStream fileOutputStream = new FileOutputStream(savePath)) {
            byte[] dataBuffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = in.read(dataBuffer, 0, 1024)) != -1) {
                fileOutputStream.write(dataBuffer, 0, bytesRead);
            }
        } catch (IOException e) {
            JOptionPane.showMessageDialog(this, "Erro ao baixar " + fileURL + ": " + e.getMessage(), "Erro", JOptionPane.ERROR_MESSAGE);
        }
    }

    private String getFileName(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }

    private String getCellValue(Cell cell) {
        return (cell == null) ? "" : cell.toString().trim();
    }

    private int getNumericCellValue(Cell cell) {
        return (cell == null) ? 0 : (int) cell.getNumericCellValue();
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(DownloadGUI::new);
    }
}
