package com.weizhi.agent.service;

import com.weizhi.agent.model.DocumentChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class RagRetriever {
    private static final Logger log = LoggerFactory.getLogger(RagRetriever.class);

    private final DocumentService documentService;

    public RagRetriever(DocumentService documentService) {
        this.documentService = documentService;
    }

    /**
     * Retrieves the top most relevant chunks for a given query from specified documents.
     *
     * @param query          user question or prompt
     * @param allowedDocIds  list of document IDs to search within (null/empty means search all)
     * @param topN           maximum number of chunks to return
     * @return list of matching DocumentChunks ordered by relevance score descending
     */
    public List<DocumentChunk> retrieve(String query, List<String> allowedDocIds, int topN) {
        List<DocumentChunk> chunks = documentService.getAllChunks(allowedDocIds);
        if (chunks.isEmpty() || query == null || query.isBlank()) {
            return new ArrayList<>();
        }

        log.info("RAG: Matching query '{}' against {} text chunks...", query, chunks.size());

        List<String> queryTokens = tokenize(query);
        if (queryTokens.isEmpty()) {
            return new ArrayList<>();
        }

        // 1. Calculate Document Frequency (DF) for each term in the corpus
        Map<String, Integer> docFrequency = new HashMap<>();
        List<List<String>> tokenizedChunks = new ArrayList<>();

        for (DocumentChunk chunk : chunks) {
            List<String> tokens = tokenize(chunk.getContent());
            tokenizedChunks.add(tokens);

            Set<String> uniqueTerms = new HashSet<>(tokens);
            for (String term : uniqueTerms) {
                docFrequency.put(term, docFrequency.getOrDefault(term, 0) + 1);
            }
        }

        int totalDocs = chunks.size();

        // 2. Calculate TF-IDF vectors for all chunks
        List<Map<String, Double>> chunkVectors = new ArrayList<>();
        for (int i = 0; i < totalDocs; i++) {
            List<String> tokens = tokenizedChunks.get(i);
            Map<String, Double> tfIdfVector = new HashMap<>();
            
            Map<String, Integer> termCounts = new HashMap<>();
            for (String token : tokens) {
                termCounts.put(token, termCounts.getOrDefault(token, 0) + 1);
            }

            int numTokens = tokens.size();
            for (Map.Entry<String, Integer> entry : termCounts.entrySet()) {
                String term = entry.getKey();
                double tf = (double) entry.getValue() / numTokens;
                int df = docFrequency.getOrDefault(term, 1);
                double idf = Math.log(1.0 + (double) totalDocs / df);
                tfIdfVector.put(term, tf * idf);
            }
            chunkVectors.add(tfIdfVector);
        }

        // 3. Calculate TF-IDF vector for the query
        Map<String, Double> queryVector = new HashMap<>();
        Map<String, Integer> queryTermCounts = new HashMap<>();
        for (String token : queryTokens) {
            queryTermCounts.put(token, queryTermCounts.getOrDefault(token, 0) + 1);
        }

        int numQueryTokens = queryTokens.size();
        for (Map.Entry<String, Integer> entry : queryTermCounts.entrySet()) {
            String term = entry.getKey();
            double tf = (double) entry.getValue() / numQueryTokens;
            int df = docFrequency.getOrDefault(term, 1); // fallback to 1 if unseen in corpus
            double idf = Math.log(1.0 + (double) totalDocs / df);
            queryVector.put(term, tf * idf);
        }

        // 4. Calculate Cosine Similarity for each chunk
        List<ChunkScore> scoredChunks = new ArrayList<>();
        double queryMagnitude = getVectorMagnitude(queryVector);

        for (int i = 0; i < totalDocs; i++) {
            DocumentChunk chunk = chunks.get(i);
            Map<String, Double> chunkVector = chunkVectors.get(i);

            double similarity = 0.0;
            if (queryMagnitude > 0.0) {
                double dotProduct = 0.0;
                for (String term : queryVector.keySet()) {
                    if (chunkVector.containsKey(term)) {
                        dotProduct += queryVector.get(term) * chunkVector.get(term);
                    }
                }
                double chunkMagnitude = getVectorMagnitude(chunkVector);
                if (chunkMagnitude > 0.0) {
                    similarity = dotProduct / (queryMagnitude * chunkMagnitude);
                }
            }

            // Also check for sub-string literal overlap to boost exact phrase matching
            double boost = calculatePhraseOverlapBoost(query.toLowerCase(), chunk.getContent().toLowerCase());
            double finalScore = similarity + boost;

            if (finalScore > 0.0) {
                scoredChunks.add(new ChunkScore(chunk, finalScore));
            }
        }

        // 5. Sort by score descending and take Top-N
        scoredChunks.sort((a, b) -> Double.compare(b.score, a.score));
        
        List<DocumentChunk> results = new ArrayList<>();
        int count = Math.min(topN, scoredChunks.size());
        for (int i = 0; i < count; i++) {
            results.add(scoredChunks.get(i).chunk);
        }

        log.info("RAG: Selected Top-{} relevant context segments. Top score: {}", results.size(), 
                scoredChunks.isEmpty() ? 0.0 : scoredChunks.get(0).score);

        return results;
    }

    private double getVectorMagnitude(Map<String, Double> vector) {
        double sumSquares = 0.0;
        for (double val : vector.values()) {
            sumSquares += val * val;
        }
        return Math.sqrt(sumSquares);
    }

    /**
     * Boosts chunks containing exact substring phrases from the query.
     */
    private double calculatePhraseOverlapBoost(String query, String content) {
        if (query.length() < 3) return 0.0;
        if (content.contains(query)) {
            return 0.15; // High exact match boost
        }
        // Sub-phrases of length 4+
        int wordsMatch = 0;
        String[] words = query.split("\\s+");
        for (String word : words) {
            if (word.length() >= 4 && content.contains(word)) {
                wordsMatch++;
            }
        }
        return wordsMatch * 0.02;
    }

    private List<String> tokenize(String text) {
        List<String> tokens = new ArrayList<>();
        if (text == null || text.isBlank()) return tokens;

        String normalized = text.toLowerCase();

        // 1. English words
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[a-zA-Z0-9]+").matcher(normalized);
        while (m.find()) {
            tokens.add(m.group());
        }

        // 2. Chinese characters
        for (int i = 0; i < normalized.length(); i++) {
            char c = normalized.charAt(i);
            if (isChineseCharacter(c)) {
                tokens.add(String.valueOf(c));
            }
        }
        return tokens;
    }

    private boolean isChineseCharacter(char c) {
        Character.UnicodeBlock block = Character.UnicodeBlock.of(c);
        return block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS
                || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A
                || block == Character.UnicodeBlock.CJK_COMPATIBILITY_IDEOGRAPHS
                || block == Character.UnicodeBlock.CJK_SYMBOLS_AND_PUNCTUATION;
    }

    private static class ChunkScore {
        final DocumentChunk chunk;
        final double score;

        ChunkScore(DocumentChunk chunk, double score) {
            this.chunk = chunk;
            this.score = score;
        }
    }
}
