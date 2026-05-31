package com.weizhi.agent.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service encapsulating web search logic with Tavily support, Bing scraping fallback,
 * and robust offline local date/time environment injection.
 */
@Service
public class SearchTools {
    private static final Logger log = LoggerFactory.getLogger(SearchTools.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${tavily.api-key:}")
    private String tavilyApiKey;

    @Value("${tavily.endpoint:https://api.tavily.com/search}")
    private String tavilyEndpoint;

    public SearchTools(OkHttpClient okHttpClient, ObjectMapper objectMapper) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Performs a web search using the best available channel.
     *
     * @param query search query
     * @return search result text to append to model context
     */
    public String search(String query) {
        log.info("SearchTools: executing web search for query: '{}'", query);

        // 1. Try Tavily Search API if key is provided
        if (tavilyApiKey != null && !tavilyApiKey.isBlank()) {
            try {
                String tavilyResult = executeTavilySearch(query);
                if (tavilyResult != null && !tavilyResult.isBlank()) {
                    log.info("SearchTools: Tavily Search succeeded.");
                    return tavilyResult;
                }
            } catch (Exception e) {
                log.warn("Tavily search failed: {}. Falling back to Bing scraper.", e.getMessage());
            }
        }

        // 2. Try scraping Bing Search
        try {
            String bingResult = executeBingScraper(query);
            if (bingResult != null && !bingResult.isBlank()) {
                log.info("SearchTools: Bing scraper succeeded.");
                return bingResult;
            }
        } catch (Exception e) {
            log.warn("Bing scraper failed: {}. Falling back to local date/time context.", e.getMessage());
        }

        // 3. Absolute Fallback: Mock search context (with current local time/date)
        log.info("SearchTools: falling back to local system context.");
        return getFallbackSearchContext(query);
    }

    private String executeTavilySearch(String query) throws Exception {
        Map<String, Object> bodyMap = Map.of(
                "api_key", tavilyApiKey,
                "query", query,
                "search_depth", "basic",
                "include_answer", false
        );

        Request httpRequest = new Request.Builder()
                .url(tavilyEndpoint)
                .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                .build();

        try (Response response = httpClient.newCall(httpRequest).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                log.warn("Tavily API returned status code: {}", response.code());
                return null;
            }
            String raw = response.body().string();
            JsonNode root = objectMapper.readTree(raw);
            JsonNode resultsNode = root.path("results");
            if (resultsNode.isMissingNode() || resultsNode.size() == 0) {
                return null;
            }

            StringBuilder sb = new StringBuilder();
            sb.append("### 🔍 Web Search Results for \"").append(query).append("\" (via Tavily):\n\n");
            int idx = 1;
            for (JsonNode res : resultsNode) {
                String title = res.path("title").asText("Untitled");
                String url = res.path("url").asText("");
                String content = res.path("content").asText("");
                sb.append(idx).append(". **").append(title).append("**\n");
                sb.append("   - URL: ").append(url).append("\n");
                sb.append("   - Summary: ").append(content).append("\n\n");
                idx++;
                if (idx > 5) break; // Limit to 5 results
            }
            return sb.toString();
        }
    }

    private String executeBingScraper(String query) throws Exception {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        String url = "https://www.bing.com/search?q=" + encodedQuery;

        Request request = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return null;
            }
            String html = response.body().string();

            // Simple parsing of Bing results using regex
            Pattern pattern = Pattern.compile("<li class=\"b_algo\"[^>]*>.*?<h2><a href=\"([^\"]+)\"[^>]*>(.*?)</a></h2>.*?<div class=\"b_caption\"[^>]*>(?:<p>|.*?<div class=\"b_snippet\"[^>]*><p>)(.*?)</p>", Pattern.DOTALL);
            Matcher matcher = pattern.matcher(html);

            StringBuilder sb = new StringBuilder();
            int idx = 1;
            while (matcher.find() && idx <= 4) {
                String resultUrl = matcher.group(1);
                String title = matcher.group(2).replaceAll("<[^>]*>", "").trim(); // strip html tags
                String snippet = matcher.group(3).replaceAll("<[^>]*>", "").trim();

                if (sb.length() == 0) {
                    sb.append("### 🔍 Web Search Results for \"").append(query).append("\" (via Bing Scraper):\n\n");
                }
                sb.append(idx).append(". **").append(title).append("**\n");
                sb.append("   - URL: ").append(resultUrl).append("\n");
                sb.append("   - Summary: ").append(snippet).append("\n\n");
                idx++;
            }

            if (sb.length() == 0) {
                // Try looser pattern just in case Bing layout changed slightly
                Pattern loosePattern = Pattern.compile("<h2><a href=\"([^\"]+)\"[^>]*>(.*?)</a></h2>", Pattern.DOTALL);
                Matcher looseMatcher = loosePattern.matcher(html);
                while (looseMatcher.find() && idx <= 4) {
                    String resultUrl = looseMatcher.group(1);
                    String title = looseMatcher.group(2).replaceAll("<[^>]*>", "").trim();
                    if (resultUrl.startsWith("http")) {
                        if (sb.length() == 0) {
                            sb.append("### 🔍 Web Search Results for \"").append(query).append("\" (via Bing Scraper):\n\n");
                        }
                        sb.append(idx).append(". **").append(title).append("**\n");
                        sb.append("   - URL: ").append(resultUrl).append("\n");
                        sb.append("   - Summary: (网页快照摘要已加载)\n\n");
                        idx++;
                    }
                }
            }

            return sb.length() > 0 ? sb.toString() : null;
        }
    }

    private String getFallbackSearchContext(String query) {
        LocalDate now = LocalDate.now();
        String formattedDate = now.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
        String dayOfWeek = now.getDayOfWeek().getValue() == 7 ? "星期日" : "星期" + getChineseNumber(now.getDayOfWeek().getValue());

        return "### 🔍 Web Search Results (本地时效与日期兜底快照):\n\n"
                + "当前处于离线/免密搜索引擎容灾降级模式，我们为您自动注入了以下系统实时时效环境信息，以供解答用户当前日期与时序类问题：\n"
                + "1. **当前系统日期**：" + formattedDate + " (" + dayOfWeek + ")\n"
                + "2. **当前系统年份**：2026年\n"
                + "3. **注意事项**：无法建立与互联网大带宽爬取的连通。请基于系统日期 (" + formattedDate + ") 告诉用户今天是几号，并告知用户由于网络原因已自动降级为本地时效快照。\n\n"
                + "对于搜索词 \"" + query + "\"，已为您的上下文附带了此基础日期。";
    }

    private String getChineseNumber(int num) {
        String[] cnNums = {"零", "一", "二", "三", "四", "五", "六"};
        if (num >= 1 && num <= 6) return cnNums[num];
        return String.valueOf(num);
    }
}
