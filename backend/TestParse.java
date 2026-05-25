import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class TestParse {
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
        StringBuilder raw = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            raw.append(line);
        }
        
        System.out.println("Raw length: " + raw.length());
        
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode root = objectMapper.readTree(raw.toString());
        JsonNode messageNode = root.path("choices").path(0).path("message");
        
        System.out.println("Message node keys:");
        messageNode.fieldNames().forEachRemaining(System.out::println);
        
        if (messageNode.has("images")) {
            System.out.println("Found images array!");
            JsonNode imagesNode = messageNode.path("images");
            for (JsonNode imgNode : imagesNode) {
                String b64DataUrl = imgNode.path("image_url").path("url").asText("");
                System.out.println("URL starts with: " + b64DataUrl.substring(0, Math.min(30, b64DataUrl.length())));
                if (b64DataUrl.startsWith("data:image/")) {
                    int commaIdx = b64DataUrl.indexOf(',');
                    System.out.println("Comma index: " + commaIdx);
                    if (commaIdx > 0) {
                        String base64 = b64DataUrl.substring(commaIdx + 1);
                        System.out.println("Base64 length: " + base64.length());
                        try {
                            byte[] data = Base64.getDecoder().decode(base64);
                            System.out.println("Decoded length: " + data.length);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
        
        if (messageNode.has("tool_calls") && !messageNode.path("tool_calls").isNull()) {
            System.out.println("Found tool_calls: " + messageNode.path("tool_calls").toString());
        } else if (messageNode.has("function_call") && !messageNode.path("function_call").isNull()) {
            System.out.println("Found function_call: " + messageNode.path("function_call").toString());
        }
        
        String content = messageNode.path("content").asText("");
        System.out.println("Content: " + content);
    }
}
