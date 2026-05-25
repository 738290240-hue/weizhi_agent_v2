import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class TestOpenAI {
    public static void main(String[] args) throws Exception {
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Set OPENAI_API_KEY before running this manual test.");
        }
        String prompt = "手绘水彩插画风旅行攻略海报：以[南京]行政区划地图为主体，每个区用蓝灰色水彩块填色，虚线分界；地图上手绘当地地标建筑、山水、美食小图标。顶部糖果色描边手写体大标题“[南京]吃货和游玩地图”，搭配太阳、彩虹、云朵、帆船等可爱贴纸。四周圆角卡片分区列出“玩/吃”要点并配美食插画；右下角戴渔夫帽、拿糖葫芦和相机的卡通女孩吉祥物，左下角木牌写“快乐出游 快乐干饭”。暖米黄背景+高饱和蓝灰色，小红书治愈风，4:5竖版。";
        String body = "{\"model\":\"gpt-image-2\",\"prompt\":\"" + prompt.replace("\"", "\\\"") + "\",\"response_format\":\"b64_json\",\"n\":1,\"size\":\"1024x1024\"}";
        
        URL url = new URL("https://api.shqbb.com/v1/images/generations");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        
        System.out.println("Sending image request...");
        long start = System.currentTimeMillis();
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        
        int code = conn.getResponseCode();
        System.out.println("Response code: " + code + " in " + (System.currentTimeMillis() - start) + "ms");
        
        InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader reader = new BufferedReader(new InputStreamReader(is));
        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println(line.substring(0, Math.min(line.length(), 200)));
        }
    }
}
