# 心理学实验平台 v3.0

## 简介
基于 Galgame 视觉小说风格的全屏影院实验平台。被试观看情景视频后做出选择题并录制语音回答，核心围绕共情能力测试。

## 目录结构

```
assets/
├── audio/
│   ├── swim/           # 游泳课音频 (.wav 已就绪)
│   │   ├── q1.wav ~ q6.wav        # 问题语音 (前6题)
│   │   ├── 1_1.wav ~ 1_3.wav      # Q1 A/B/C 选项音频
│   │   ├── ...                     # 以此类推
│   │   └── 9_1.wav ~ 9_3.wav
│   ├── diningHall/     # 午餐音频 (.mp3 待放入)
│   ├── playground/     # 校运会失利音频 (.mp3 待放入)
│   ├── brokeleg/       # 摔伤腿音频 (.mp3 待放入)
│   └── failed/         # 预留
│
├── video/
│   ├── swim/           # 游泳课视频 (.mp4 已就绪)
│   │   └── Scenario1.mp4 ~ Scenario10.mp4
│   ├── diningHall/     # 午餐视频 (.mp4 待放入)
│   │   └── Scenario1.mp4 ~ Scenario10.mp4
│   ├── playground/     # 校运会失利视频 (.mp4 待放入)
│   │   └── Scenario1.mp4 ~ Scenario10.mp4
│   ├── brokeleg/       # 摔伤腿视频 (.mp4 待放入)
│   │   └── Scenario1.mp4 ~ Scenario10.mp4
│   └── failed/         # 预留
│
└── images/
    ├── 小航.png, 操场.png, 教室.png, 食堂.png, 重返校园.png
    └── ...
```

## 文件命名规范

| 类型 | 路径格式 | 示例 |
|:--|:--|:--|
| 故事视频 | `video/{storyId}/Scenario1.mp4 ~ Scenario10.mp4` | `video/swim/Scenario1.mp4` |
| 问题语音 | `audio/{storyId}/q1.mp3 ~ q6.mp3` | `audio/diningHall/q3.mp3` |
| 选项语音 | `audio/{storyId}/{qNum}_{optNum}.mp3` | `audio/playground/5_2.mp3` (Q5-B) |

## 故事配置

所有故事定义在 `js/config.js` 的 `stories` 数组中：

| id | 名称 | 状态 | 音频格式 |
|:--|:--|:--|:--|
| `swim` | 游泳课 | ✅ enabled | wav |
| `diningHall` | 午餐 | ✅ enabled | mp3 |
| `playground` | 校运会失利 | ✅ enabled | mp3 |
| `brokeleg` | 摔伤腿休养后重返校园 | ✅ enabled | mp3 |
| `failed` | 预留 | ❌ disabled | mp3 |

## 配置说明

每个故事支持以下字段：`id`, `name`, `enabled`, `audioExt`, `videoFolder`, `audioFolder`, `questionAudioCount`, `transitionText`, `voiceQuestion`, `questions[]`

## 调试模式

`config.js → experiment.debugMode = true` 时跳过伦理声明/麦克风测试/被试编号，直接进入故事选择器。

## 技术栈

- 纯前端 HTML/CSS/JS
- MediaRecorder API 录音
- 多后端（阿里云/LeanCloud/Supabase/本地）
