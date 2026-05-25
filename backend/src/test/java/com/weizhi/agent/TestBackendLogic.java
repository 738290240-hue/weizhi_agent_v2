import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public class TestBackendLogic {
    public static void main(String[] args) throws Exception {
        String raw = "{\"id\":\"resp_0f6b353c59148028016a126af4d3e0819fa99a343d82ed95bd\",\"object\":\"chat.completion\",\"created\":1779591924,\"model\":\"gpt-5.5\",\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"你好！有什么我可以帮你的吗？\",\"reasoning_content\":null,\"tool_calls\":null},\"finish_reason\":\"stop\",\"native_finish_reason\":\"stop\"}],\"usage\":{\"completion_tokens\":13,\"total_tokens\":396,\"prompt_tokens\":383,\"prompt_tokens_details\":{\"cached_tokens\":0},\"completion_tokens_details\":{\"reasoning_tokens\":0}}}";
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode root = objectMapper.readTree(raw);
        JsonNode messageNode = root.path("choices").path(0).path("message");
        
        Map<String, Object> result = new LinkedHashMap<>();
        
        try {
            // 1
            if (messageNode.has("images") && messageNode.path("images").isArray() && messageNode.path("images").size() > 0) {
                System.out.println("Processing images");
            }
            
            // 2
            if (messageNode.has("tool_calls") && !messageNode.path("tool_calls").isNull()) {
                System.out.println("Processing tool_calls");
            }
            
            // 2.5
            if (messageNode.has("function_call") && !messageNode.path("function_call").isNull()) {
                System.out.println("Processing function_call");
            }
            
            // 3
            String content = messageNode.path("content").asText("");
            if (content == null || content.isBlank() || "null".equals(content)) {
                content = "OpenAI 返回为空，请重试。";
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> usage = objectMapper.convertValue(root.path("usage"), Map.class);
            
            result.put("text", content);
            if (usage != null) {
                result.put("usage", usage);
            }
            System.out.println("Success! Result: " + result);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
