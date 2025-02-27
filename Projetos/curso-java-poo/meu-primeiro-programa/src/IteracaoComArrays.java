public class IteracaoComArrays {
    public static void main(String[] args) {

        int[] numeros = {1,2,3,4,5,6,7,8,9};

        for (int index = 0; index < numeros.length; index++ ){
            System.out.println(numeros[index]);
            if(index % 2 == 0){
                System.out.println("O número é par.");
            }
        }

        String[] emails = new String[5];
        emails[0] = "fulano@email.com";
        emails[1] = "cicrano@email.com";
        emails[2] = "zezinho@email.com";
        emails[3] = "pedrinho@email.com";
        emails[4] = "ritinha@email.com";

        for(int i = 0; i < emails.length; i++){
            System.out.println(emails[i]);
        }

        System.out.println("Foreach");
        for( String email : emails ){
            System.out.println(email);
        }
    }
}
