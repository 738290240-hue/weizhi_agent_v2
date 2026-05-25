import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public class TestUsage {
    public static void main(String[] args) throws Exception {
        String raw = "{\"id\":\"resp_123\",\"object\":\"chat.completion\",\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"你好\"}}]}";
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode root = objectMapper.readTree(raw);
        System.out.println("Root: " + root);
        try {
            Map<String, Object> usage = objectMapper.convertValue(root.path("usage"), Map.class);
            System.out.println("Usage: " + usage);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
