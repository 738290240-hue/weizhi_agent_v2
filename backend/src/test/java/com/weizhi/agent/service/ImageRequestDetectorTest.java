package com.weizhi.agent.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ImageRequestDetectorTest {
    @Test
    void detectsDirectImageGenerationRequest() {
        assertTrue(ImageRequestDetector.looksLikeImageRequest("生成一张小狗的照片"));
        assertTrue(ImageRequestDetector.looksLikeImageRequest("draw a picture of a mountain"));
    }

    @Test
    void rejectsQuestionsAboutImageGeneration() {
        assertFalse(ImageRequestDetector.looksLikeImageRequest("你生成图片为什么喜欢瞎搞"));
        assertFalse(ImageRequestDetector.looksLikeImageRequest("为什么生成图片总是出问题"));
        assertFalse(ImageRequestDetector.looksLikeImageRequest("how do you generate images"));
    }

    @Test
    void rejectsGeneratedImageResponseText() {
        assertFalse(ImageRequestDetector.looksLikeImageRequest("图片已生成: /api/images/files/be65152d-03b6.jpg"));
    }
}
