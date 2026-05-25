package com.weizhi.agent.tools;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class TtsToolsTest {

    @Test
    public void testGetLanguageBoost() {
        TtsTools ttsTools = new TtsTools(null, null, null, null);

        // Test English voice
        assertEquals("English", ttsTools.getLanguageBoost("English_Trustworthy_Man", "Hello"));
        assertEquals("English", ttsTools.getLanguageBoost("Grinch", "Merry Christmas"));
        assertEquals("English", ttsTools.getLanguageBoost("Sweet_Girl", "Hi"));

        // Test Japanese voice
        assertEquals("Japanese", ttsTools.getLanguageBoost("Japanese_IntellectualSenior", "こんにちは"));

        // Test Cantonese/Chinese voice
        assertEquals("Chinese", ttsTools.getLanguageBoost("Cantonese_CuteGirl", "你好"));
        assertEquals("Chinese", ttsTools.getLanguageBoost("male-qn-qingse", "你好"));

        // Test text fallback when voiceId is unrecognized or default
        assertEquals("Japanese", ttsTools.getLanguageBoost("male-qn-qingse", "これはテストです")); // Contains Japanese Hiragana
        assertEquals("Japanese", ttsTools.getLanguageBoost("unknown_voice", "日本語テキスト")); // Contains Katakana/Hiragana
        assertEquals("Chinese", ttsTools.getLanguageBoost("unknown_voice", "简单中文文本"));
    }
}
