import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class TestToolCall {
    public static void main(String[] args) throws Exception {
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Set OPENAI_API_KEY before running this manual test.");
        }
        String body = "{\"model\":\"gpt-5.5\",\"messages\":[{\"role\":\"user\",\"content\":\"生成一张雪纳瑞在草地上奔跑的照片\"}],\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"generate_image\",\"description\":\"Generate an image\",\"parameters\":{\"type\":\"object\",\"properties\":{\"prompt\":{\"type\":\"string\"}},\"required\":[\"prompt\"]}}}]}";
        
        URL url = new URL("https://api.shqbb.com/v1/chat/completions");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        
        System.out.println("Sending chat request...");
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        
        int code = conn.getResponseCode();
        System.out.println("Response code: " + code);
        
        InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader reader = new BufferedReader(new InputStreamReader(is));
        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println(line);
        }
    }
}
